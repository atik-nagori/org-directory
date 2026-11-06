import { HttpErrorResponse } from '@angular/common/http';
import {
  Component,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, ValidatorFn, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/i18n.translet';
import { EMAIL_PATTERN } from './organisation.mapper';
import { KNOWN_STATUSES, KnownStatus } from './organisation.model';
import { OrganisationStore } from './organisation.store';

const NAME_MIN = 3;
const NAME_MAX = 80;

type FieldName = 'name' | 'status' | 'ownerEmail' | 'memberCount';

const FIELD_ORDER: readonly FieldName[] = ['name', 'status', 'ownerEmail', 'memberCount'];

const FIELD_IDS: Record<FieldName, string> = {
  name: 'org-name',
  status: 'org-status',
  ownerEmail: 'org-owner-email',
  memberCount: 'org-member-count',
};

/** Which translation key belongs to which validation error. */
const ERROR_KEYS: Record<FieldName, Record<string, string>> = {
  name: {
    required: 'form.errors.nameRequired',
    minlength: 'form.errors.nameMinLength',
    maxlength: 'form.errors.nameMaxLength',
    duplicate: 'form.errors.nameDuplicate',
  },
  status: { required: 'form.errors.statusRequired' },
  ownerEmail: { required: 'form.errors.emailRequired', pattern: 'form.errors.emailInvalid' },
  memberCount: { memberCount: 'form.errors.memberCountMin' },
};

/** Required, 3 to 80 characters (spaces at the ends do not count), and not already used. */
function nameValidator(exists: (name: string) => boolean): ValidatorFn {
  return (control) => {
    const value = String(control.value ?? '').trim();
    if (value === '') return { required: true };
    if (value.length < NAME_MIN) return { minlength: true };
    if (value.length > NAME_MAX) return { maxlength: true };
    if (exists(value)) return { duplicate: true };
    return null;
  };
}

/** Optional. If filled in, it must be a whole number, 0 or more. */
const memberCountValidator: ValidatorFn = (control) => {
  const value = String(control.value ?? '').trim();
  return value === '' || /^\d+$/.test(value) ? null : { memberCount: true };
};

@Component({
  selector: 'app-organisation-form',
  imports: [ReactiveFormsModule, RouterLink, TranslatePipe],
  templateUrl: './organisation-form.html',
  styleUrl: './organisation-form.css',
})
export class OrganisationForm {
  private readonly store = inject(OrganisationStore);
  private readonly i18n = inject(I18nService);
  private readonly injector = inject(Injector);

  protected readonly statusOptions = KNOWN_STATUSES;
  protected readonly ids = FIELD_IDS;

  /** Typed and non-nullable: reset() goes back to these values, never to null. */
  protected readonly form = new FormGroup({
    name: new FormControl('', {
      nonNullable: true,
      validators: [nameValidator((name) => this.store.nameExists(name))],
    }),
    status: new FormControl<KnownStatus | ''>('', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    ownerEmail: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.pattern(EMAIL_PATTERN)],
    }),
    memberCount: new FormControl('', { nonNullable: true, validators: [memberCountValidator] }),
  });

  protected readonly saving = signal(false);
  protected readonly success = signal(false);
  protected readonly serverError = signal(false);
  private readonly submitAttempted = signal(false);

  /** Reactive forms are not signals. This makes the computed values below re-run when the form changes. */
  private readonly formEvents = toSignal(this.form.events, { initialValue: null });

  /** A message only shows after the field was touched (blurred) or the user pressed submit. */
  protected readonly errors = computed<Record<FieldName, string | null>>(() => {
    this.formEvents();
    return {
      name: this.messageFor('name'),
      status: this.messageFor('status'),
      ownerEmail: this.messageFor('ownerEmail'),
      memberCount: this.messageFor('memberCount'),
    };
  });

  /** The list at the top of the form. Only after the first submit attempt. */
  protected readonly summary = computed(() => {
    if (!this.submitAttempted()) return [];
    const errors = this.errors();
    return FIELD_ORDER.flatMap((field) => {
      const message = errors[field];
      return message ? [{ field, message }] : [];
    });
  });

  private readonly summaryRef = viewChild<ElementRef<HTMLElement>>('summaryBox');
  private readonly nameInput = viewChild.required<ElementRef<HTMLInputElement>>('nameInput');

  constructor() {
    // Needed when the page is opened directly, so the unique check has names to compare with.
    void this.store.load();
  }

  protected async submit(): Promise<void> {
    if (this.saving()) return;
    this.success.set(false);
    this.serverError.set(false);

    // More names may have loaded since the last keystroke.
    this.form.controls.name.updateValueAndValidity();
    this.submitAttempted.set(true);

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.focusSummary();
      return;
    }

    const value = this.form.getRawValue();
    const status = KNOWN_STATUSES.find((option) => option === value.status);
    if (status === undefined) return; // cannot happen: the status validator already passed

    this.saving.set(true);
    try {
      await this.store.create({
        name: value.name.trim(),
        status,
        ownerEmail: value.ownerEmail,
        memberCount: value.memberCount.trim() === '' ? null : Number(value.memberCount),
      });
      this.form.reset();
      this.submitAttempted.set(false);
      this.success.set(true);
      afterNextRender(() => this.nameInput().nativeElement.focus(), { injector: this.injector });
    } catch (error) {
      if (error instanceof HttpErrorResponse && error.status === 409) {
        // The name exists on a page that has not loaded yet. The server knows.
        this.form.controls.name.setErrors({ duplicate: true });
        this.form.markAllAsTouched();
        this.focusSummary();
      } else {
        this.serverError.set(true);
      }
    } finally {
      this.saving.set(false);
    }
  }

  protected focusField(field: FieldName): void {
    document.getElementById(FIELD_IDS[field])?.focus();
  }

  private messageFor(field: FieldName): string | null {
    const control = this.form.controls[field];
    if (!control.touched || control.valid) return null;

    const keys = ERROR_KEYS[field];
    const code = Object.keys(control.errors ?? {}).find((errorCode) => errorCode in keys);
    return code === undefined
      ? null
      : this.i18n.t(keys[code], { min: NAME_MIN, max: NAME_MAX });
  }

  /** Moves keyboard and screen reader focus to the summary once it is on screen. */
  private focusSummary(): void {
    afterNextRender(() => this.summaryRef()?.nativeElement.focus(), { injector: this.injector });
  }
}