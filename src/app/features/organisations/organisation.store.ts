import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import {
  API_URL,
  MAX_PAGE_SIZE,
  RATE_LIMIT,
  RATE_WINDOW_MS,
} from '../../core/mock-api/mock-api.interceptor';
import { toOrganisation } from './organisation.mapper';
import { NewOrganisation, Organisation } from './organisation.model';

interface PageResponse {
  items: unknown[];
  total: number;
}

export type LoadState = 'loading' | 'ready' | 'error';

/** Keeps keys of created rows apart from the keys of API rows (positions 0 to 136). */
const CREATED_POSITION_BASE = 10_000;

@Injectable({ providedIn: 'root' })
export class OrganisationStore {
  private readonly http = inject(HttpClient);

  // Raw state, private. Pages are kept by number so a retry can fill a gap in place.
  private readonly pages = signal<ReadonlyMap<number, Organisation[]>>(new Map());
  private readonly createdOrgs = signal<readonly Organisation[]>([]);
  private readonly firstPageFailed = signal(false);
  private readonly running = signal(false);
  private readonly waiting = signal(0);
  private readonly failed = signal<readonly number[]>([]);
  private readonly totalFromApi = signal<number | null>(null);

  // When we sent each request, so we never go over 5 per minute.
  private sentAt: number[] = [];

  // Public, read only.
  readonly total = this.totalFromApi.asReadonly();
  readonly failedPages = this.failed.asReadonly();
  readonly isLoadingMore = this.running.asReadonly();
  readonly waitSeconds = this.waiting.asReadonly();

  private readonly fromApi = computed<Organisation[]>(() =>
    [...this.pages().entries()].sort(([a], [b]) => a - b).flatMap(([, items]) => items),
  );

  /** How many rows came from the paged API. The progress line compares this with `total`. */
  readonly loadedFromApi = computed(() => this.fromApi().length);

  /** Newly created organisations first, then the API rows. */
  readonly organisations = computed<Organisation[]>(() => [
    ...this.createdOrgs(),
    ...this.fromApi(),
  ]);

  private readonly knownNames = computed(
    () =>
      new Set(
        this.organisations().flatMap((org) => (org.name === null ? [] : [org.name.toLowerCase()])),
      ),
  );

  readonly state = computed<LoadState>(() => {
    if (this.pages().has(1)) return 'ready';
    return this.firstPageFailed() ? 'error' : 'loading';
  });

  /** Case-insensitive. Only knows the names loaded so far; the server has the final say. */
  nameExists(name: string): boolean {
    return this.knownNames().has(name.trim().toLowerCase());
  }

  /** Throws HttpErrorResponse on failure (409 = duplicate name). */
  async create(input: NewOrganisation): Promise<void> {
    const body = {
      name: input.name,
      status: input.status,
      owner: { email: input.ownerEmail },
      ...(input.memberCount === null ? {} : { memberCount: input.memberCount }),
    };
    const response = await firstValueFrom(this.http.post<unknown>(API_URL, body));
    this.createdOrgs.update((list) => [
      toOrganisation(response, CREATED_POSITION_BASE + list.length),
      ...list,
    ]);
  }

  /** Loads page 1, then every missing page in the background. Calling it again is the retry. */
  async load(): Promise<void> {
    if (this.running()) return;
    this.running.set(true);
    this.firstPageFailed.set(false);

    try {
      if (!this.pages().has(1)) {
        const ok = await this.fetchPage(1);
        if (!ok) {
          this.firstPageFailed.set(true);
          return;
        }
      }

      const totalPages = Math.ceil((this.totalFromApi() ?? 0) / MAX_PAGE_SIZE);
      this.failed.set([]);

      for (let page = 2; page <= totalPages; page++) {
        if (this.pages().has(page)) continue;
        const ok = await this.fetchPage(page);
        if (!ok) this.failed.update((list) => [...list, page]);
      }
    } finally {
      this.running.set(false);
    }
  }

  /** Returns true if the page loaded. A 429 is waited out and retried. Anything else counts as a failure. */
  private async fetchPage(page: number): Promise<boolean> {
    while (true) {
      await this.waitForSlot();
      this.sentAt.push(Date.now());

      try {
        const response = await firstValueFrom(
          this.http.get<PageResponse>(API_URL, { params: { page, pageSize: MAX_PAGE_SIZE } }),
        );
        const firstPosition = (page - 1) * MAX_PAGE_SIZE;
        const mapped = response.items.map((raw, index) => toOrganisation(raw, firstPosition + index));
        this.totalFromApi.set(response.total);
        this.pages.update((current) => new Map(current).set(page, mapped));
        return true;
      } catch (error) {
        if (error instanceof HttpErrorResponse && error.status === 429) {
          this.sentAt.pop(); // the server did not count a rejected request
          const seconds = Number(error.headers.get('Retry-After')) || RATE_WINDOW_MS / 1000;
          await this.countdown(seconds * 1000);
          continue; // try the same page again
        }
        return false;
      }
    }
  }

  /** Waits until fewer than 5 requests were sent in the last 60 seconds. */
  private async waitForSlot(): Promise<void> {
    while (true) {
      const now = Date.now();
      this.sentAt = this.sentAt.filter((time) => now - time < RATE_WINDOW_MS);
      if (this.sentAt.length < RATE_LIMIT) return;
      const oldest = this.sentAt[0];
      await this.countdown(RATE_WINDOW_MS - (now - oldest) + 250); // small safety margin
    }
  }

  /** Sleeps, and updates `waitSeconds` every second so the UI can show a countdown. */
  private async countdown(milliseconds: number): Promise<void> {
    const end = Date.now() + milliseconds;
    while (Date.now() < end) {
      this.waiting.set(Math.ceil((end - Date.now()) / 1000));
      await new Promise((resolve) => setTimeout(resolve, Math.max(0, Math.min(1000, end - Date.now()))));
    }
    this.waiting.set(0);
  }
}