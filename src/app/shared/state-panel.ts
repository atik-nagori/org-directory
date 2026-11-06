import { Component, computed, input } from '@angular/core';

export type StateKind = 'loading' | 'empty' | 'error';

// Symbols, not words. They are hidden from screen readers; the title carries the meaning.
const ICONS: Record<StateKind, string> = { loading: '…', empty: '○', error: '!' };

/** Loading, empty and error look different: border style, icon and colour all differ. */
@Component({
  selector: 'app-state-panel',
  host: {
    '[attr.data-kind]': 'kind()',
    '[attr.role]': "kind() === 'error' ? 'alert' : 'status'",
  },
  template: `
    <span class="icon" aria-hidden="true">{{ icon() }}</span>
    <div class="body">
      <p class="title">{{ title() }}</p>
      @if (message()) {
        <p class="message">{{ message() }}</p>
      }
      <ng-content />
    </div>
  `,
  styles: `
    :host {
      display: flex;
      align-items: flex-start;
      gap: var(--space-4);
      padding: var(--space-5);
      background: var(--color-surface);
      color: var(--color-text-muted);
      border: var(--border-width) solid var(--color-border);
      border-radius: var(--radius-md);
    }
    :host([data-kind='empty']) {
      background: var(--color-bg);
      border-style: dashed;
    }
    :host([data-kind='error']) {
      background: var(--color-danger-bg);
      color: var(--color-danger);
      border-color: var(--color-danger);
    }
    .icon {
      flex: none;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: var(--size-control-height);
      height: var(--size-control-height);
      font-weight: var(--font-weight-bold);
      border: calc(var(--border-width) * 2) solid currentColor;
      border-radius: 50%;
    }
    p {
      margin: 0;
    }
    .title {
      font-weight: var(--font-weight-bold);
      font-size: var(--font-size-lg);
    }
    .message {
      margin-top: var(--space-1);
    }
  `,
})
export class StatePanel {
  readonly kind = input.required<StateKind>();
  readonly title = input.required<string>();
  readonly message = input<string>('');

  protected readonly icon = computed(() => ICONS[this.kind()]);
}