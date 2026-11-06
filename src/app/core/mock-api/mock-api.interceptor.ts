import {
  HttpErrorResponse,
  HttpHeaders,
  HttpInterceptorFn,
  HttpResponse,
} from '@angular/common/http';
import { Observable, mergeMap, of, throwError, timer } from 'rxjs';
import fixture from './organisations.json';

// Change these to test. For example FAILURE_RATE = 0 for no random failures, or 1 for always.
export const API_URL = '/api/organisations';
export const MAX_PAGE_SIZE = 25;
export const RATE_LIMIT = 5;
export const RATE_WINDOW_MS = 60_000;
const FAILURE_RATE = 0.15;
const MIN_DELAY_MS = 400;
const MAX_DELAY_MS = 900;

type RawRecord = Record<string, unknown>;

// The "database". It lives in memory and is reset on every page reload.
const records: RawRecord[] = [...(fixture as RawRecord[])];
// Organisations created through POST. Kept apart from the paged fixture so its total of 137 stays stable.
const added: RawRecord[] = [];
// When each accepted list request happened, to enforce the rate limit.
const requestTimes: number[] = [];

const toPositiveInt = (value: string | null, fallback: number): number => {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const normaliseName = (value: unknown): string =>
  typeof value === 'string' ? value.trim().toLowerCase() : '';

export const mockApiInterceptor: HttpInterceptorFn = (req, next) => {
  if (!req.url.startsWith(API_URL)) {
    return next(req); // not ours, let it go to the network
  }

  // Wait 400 to 900 ms before emitting, like a real server.
  const delayed = <T>(source$: Observable<T>) =>
    timer(MIN_DELAY_MS + Math.random() * (MAX_DELAY_MS - MIN_DELAY_MS)).pipe(
      mergeMap(() => source$),
    );
  const ok = (status: number, body: unknown) =>
    of(new HttpResponse({ status, body, url: req.url }));
  const fail = (status: number, message: string, headers?: HttpHeaders) =>
    throwError(
      () =>
        new HttpErrorResponse({
          status,
          statusText: message,
          error: { message },
          headers,
          url: req.url,
        }),
    );

  // GET /api/organisations?page=1&pageSize=25
  if (req.method === 'GET') {
    const now = Date.now();

    // Forget requests older than one minute.
    while (requestTimes.length > 0 && now - requestTimes[0] >= RATE_WINDOW_MS) {
      requestTimes.shift();
    }

    // Over the limit: 429 plus how many seconds to wait. Rejected requests are not counted.
    if (requestTimes.length >= RATE_LIMIT) {
      const retryAfterSeconds = Math.ceil((RATE_WINDOW_MS - (now - requestTimes[0])) / 1000);
      return delayed(
        fail(429, 'Too many requests', new HttpHeaders({ 'Retry-After': String(retryAfterSeconds) })),
      );
    }
    requestTimes.push(now); // random failures below still count against the limit

    if (Math.random() < FAILURE_RATE) {
      return delayed(fail(500, 'Simulated server error'));
    }

    const page = toPositiveInt(req.params.get('page'), 1);
    const pageSize = Math.min(toPositiveInt(req.params.get('pageSize'), MAX_PAGE_SIZE), MAX_PAGE_SIZE);
    const start = (page - 1) * pageSize;

    return delayed(
      ok(200, {
        items: records.slice(start, start + pageSize),
        total: records.length,
        page,
        pageSize,
      }),
    );
  }

  // POST /api/organisations (used by the create form in Phase 7)
    // POST /api/organisations
  if (req.method === 'POST') {
    const body = (req.body ?? {}) as RawRecord;
    const name = normaliseName(body['name']);

    if (name === '') {
      return delayed(fail(400, 'Name is required'));
    }

    // The server checks ALL records, even pages the browser has not loaded yet.
    const everything = [...records, ...added];
    if (everything.some((record) => normaliseName(record['name']) === name)) {
      return delayed(fail(409, 'An organisation with this name already exists'));
    }

    const highestId = Math.max(
      0,
      ...everything.map((record) => (typeof record['id'] === 'number' ? record['id'] : 0)),
    );
    const created: RawRecord = { ...body, id: highestId + 1, createdAt: new Date().toISOString() };
    added.push(created);
    return delayed(ok(201, created));
  }

  return delayed(fail(405, 'Method not allowed'));
};