import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, DestroyRef, computed, inject, linkedSignal, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Params, Router } from '@angular/router';
import { TranslatePipe } from '../../core/i18n/i18n.translet';
import { StatePanel } from '../../shared/state-panel';
import { StatusBadge } from '../../shared/status-badge';
import { KNOWN_STATUSES, OrgStatus } from './organisation.model';
import { OrganisationStore } from './organisation.store';

type SortKey = 'name' | 'created';
type SortDirection = 'asc' | 'desc';

const SEARCH_DEBOUNCE_MS = 300;
const STATUS_OPTIONS: readonly OrgStatus[] = [...KNOWN_STATUSES, 'unknown'];

const collator = new Intl.Collator(undefined, { sensitivity: 'base', numeric: true });

/** Missing values (null) always go last, in both directions. */
function compareNullsLast<T>(
  first: T | null,
  second: T | null,
  compare: (a: T, b: T) => number,
  direction: 1 | -1,
): number {
  if (first === null && second === null) return 0;
  if (first === null) return 1;
  if (second === null) return -1;
  return compare(first, second) * direction;
}

@Component({
  selector: 'app-organisation-list',
  imports: [TranslatePipe, StatusBadge, StatePanel, DatePipe, DecimalPipe],
  templateUrl: './organisation-list.html',
  styleUrl: './organisation-list.css',
})
export class OrganisationList {
  protected readonly store = inject(OrganisationStore);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly statusOptions = STATUS_OPTIONS;
  private searchTimer: ReturnType<typeof setTimeout> | undefined;

  // The URL is the source of truth for the search text and the status filter.
  private readonly params = toSignal(this.route.queryParamMap, {
    initialValue: this.route.snapshot.queryParamMap,
  });

  protected readonly query = computed(() => (this.params().get('q') ?? '').trim());

  /** An unknown value in the URL, like ?status=bogus, is ignored and means "all". */
  protected readonly statusFilter = computed<OrgStatus | ''>(() => {
    const value = this.params().get('status');
    return STATUS_OPTIONS.find((option) => option === value) ?? '';
  });

  /**
   * What the search box shows. It follows the URL (Back button, Clear filters),
   * but keeps the user's own text if it only differs by spaces. Without this,
   * typing "north " would be trimmed to "north" while the user is still typing.
   */
  protected readonly searchText = linkedSignal<string, string>({
    source: this.query,
    computation: (query, previous) =>
      previous && previous.value.trim() === query ? previous.value : query,
  });

  protected readonly hasFilters = computed(
    () => this.query() !== '' || this.statusFilter() !== '',
  );

  /** Filter first, then sort. Both re-run when new pages arrive. */
  protected readonly filtered = computed(() => {
    const query = this.query().toLocaleLowerCase();
    const status = this.statusFilter();
    return this.store
      .organisations()
      .filter(
        (org) =>
          (status === '' || org.status === status) &&
          (query === '' || (org.name?.toLocaleLowerCase().includes(query) ?? false)),
      );
  });

  protected readonly sortKey = signal<SortKey | null>(null); // null = API order
  protected readonly sortDirection = signal<SortDirection>('asc');

  protected readonly rows = computed(() => {
    const key = this.sortKey();
    const list = this.filtered();
    if (key === null) return list;

    const direction = this.sortDirection() === 'asc' ? 1 : -1;
    // sort() is stable, so rows that tie keep their API order.
    return [...list].sort((a, b) =>
      key === 'name'
        ? compareNullsLast(a.name, b.name, (x, y) => collator.compare(x, y), direction)
        : compareNullsLast(
            a.createdAt?.getTime() ?? null,
            b.createdAt?.getTime() ?? null,
            (x, y) => x - y,
            direction,
          ),
    );
  });

  protected readonly loadedCount = computed(() => this.store.organisations().length);

  /** True while pages are still missing, either loading or failed. */
  protected readonly isIncomplete = computed(() => {
    const total = this.store.total();
    return total !== null && this.loadedCount() < total;
  });

  constructor() {
    void this.store.load();
    inject(DestroyRef).onDestroy(() => clearTimeout(this.searchTimer));
  }

  /** Updates the box straight away, and the URL 300 ms after the last keystroke. */
  protected onSearchInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.searchText.set(value);
    clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(
      () => this.updateUrl({ q: value.trim() || null }),
      SEARCH_DEBOUNCE_MS,
    );
  }

  protected onStatusChange(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.updateUrl({ status: value || null });
  }

  protected clearFilters(): void {
    clearTimeout(this.searchTimer);
    this.updateUrl({ q: null, status: null });
  }

  /** null removes the parameter. 'merge' keeps the other one. replaceUrl avoids a history entry per change. */
  private updateUrl(changes: Params): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: changes,
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  protected retry(): void {
    void this.store.load(); // skips pages it already has
  }

  protected toggleSort(key: SortKey): void {
    if (this.sortKey() === key) {
      this.sortDirection.update((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      this.sortKey.set(key);
      this.sortDirection.set('asc');
    }
  }

  protected ariaSort(key: SortKey): 'ascending' | 'descending' | 'none' {
    if (this.sortKey() !== key) return 'none';
    return this.sortDirection() === 'asc' ? 'ascending' : 'descending';
  }

  protected sortIndicator(key: SortKey): string {
    if (this.sortKey() !== key) return '';
    return this.sortDirection() === 'asc' ? '▲' : '▼';
  }
}