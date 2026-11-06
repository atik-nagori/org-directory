import { Component, input } from '@angular/core';
import { TranslatePipe } from '../core/i18n/i18n.translet';
import { OrgStatus } from '../features/organisations/organisation.model';

/** A coloured dot AND a visible text label. Colour is never the only signal. */
@Component({
  selector: 'app-status-badge',
  imports: [TranslatePipe],
  host: { '[attr.data-status]': 'status()' },
  template: `
    <span class="dot" aria-hidden="true"></span>
    <span>{{ 'status.' + status() | t }}</span>
  `,
  styles: `
    :host {
      display: inline-flex;
      align-items: center;
      gap: var(--space-2);
      white-space: nowrap;
    }
    .dot {
      width: var(--size-dot);
      height: var(--size-dot);
      border-radius: 50%;
      background: var(--color-status-unknown);
    }
    :host([data-status='active']) .dot { background: var(--color-status-active); }
    :host([data-status='inactive']) .dot { background: var(--color-status-inactive); }
    :host([data-status='suspended']) .dot { background: var(--color-status-suspended); }
  `,
})
export class StatusBadge {
  readonly status = input.required<OrgStatus>();
}