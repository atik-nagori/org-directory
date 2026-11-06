import { KNOWN_STATUSES, KnownStatus, Organisation, OrgStatus } from './organisation.model';

export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Raw = Record<string, unknown>;

const isRecord = (value: unknown): value is Raw =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

function toId(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/** "" and null become null. The UI shows a translated "Unnamed organisation". */
function toName(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

/** "ACTIVE" and "Active" become "active". A typo like "actve" or null becomes "unknown". We never guess. */
function toStatus(value: unknown): OrgStatus {
  if (typeof value !== 'string') return 'unknown';
  const normalised = value.trim().toLowerCase();
  return (KNOWN_STATUSES as readonly string[]).includes(normalised)
    ? (normalised as KnownStatus)
    : 'unknown';
}

/** 42 stays 42, "12" becomes 12. -1, null, "abc" and 1.5 become null. */
function toMemberCount(value: unknown): number | null {
  let count: number;
  if (typeof value === 'number') {
    count = value;
  } else if (typeof value === 'string' && value.trim() !== '') {
    count = Number(value);
  } else {
    return null;
  }
  return Number.isInteger(count) && count >= 0 ? count : null;
}

/** ISO strings and epoch milliseconds both work. "not a date" becomes null. */
function toDate(value: unknown): Date | null {
  let milliseconds = Number.NaN;
  if (typeof value === 'number') {
    milliseconds = value;
  } else if (typeof value === 'string') {
    milliseconds = Date.parse(value);
  }
  const date = new Date(milliseconds);
  return Number.isNaN(date.getTime()) ? null : date;
}

function toOwnerEmail(value: unknown): string | null {
  if (!isRecord(value)) return null; // owner is missing on some records
  const email = value['email'];
  if (typeof email !== 'string') return null;
  const trimmed = email.trim();
  return trimmed === '' ? null : trimmed;
}

/**
 * The only place that knows how messy the API data is.
 * `position` is the record's index in the whole list. It makes a unique key.
 */
export function toOrganisation(raw: unknown, position: number): Organisation {
  const record: Raw = isRecord(raw) ? raw : {};
  const ownerEmail = toOwnerEmail(record['owner']);

  return {
    key: `org-${position}`,
    id: toId(record['id']),
    name: toName(record['name']),
    status: toStatus(record['status']),
    memberCount: toMemberCount(record['memberCount']),
    ownerEmail,
    ownerEmailValid: ownerEmail !== null && EMAIL_PATTERN.test(ownerEmail),
    createdAt: toDate(record['createdAt']),
  };
}