import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { TranslatePipe } from '../../core/i18n/i18n.translet';
import { StatusBadge } from '../../shared/status-badge';
import { OrganisationStore } from './organisation.store';

type SortKey = 'name' | 'created';
type SortDirection = 'asc' | 'desc';

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
  imports: [TranslatePipe, StatusBadge, DatePipe, DecimalPipe],
  templateUrl: './organisation-list.html',
  styleUrl: './organisation-list.css',
})
export class OrganisationList {
  protected readonly store = inject(OrganisationStore);

  protected readonly sortKey = signal<SortKey | null>(null); // null = API order
  protected readonly sortDirection = signal<SortDirection>('asc');

  /** Recalculates when new pages arrive or the sort changes. */
  protected readonly rows = computed(() => {
    const key = this.sortKey();
    const list = this.store.organisations();
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

  constructor() {
    void this.store.load();
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