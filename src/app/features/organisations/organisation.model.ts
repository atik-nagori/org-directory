export const KNOWN_STATUSES = ['active', 'inactive', 'suspended'] as const;

export type KnownStatus = (typeof KNOWN_STATUSES)[number];
export type OrgStatus = KnownStatus | 'unknown';

/** What the UI works with. Every field is already clean. null means "missing or invalid". */
export interface Organisation {
  /** Unique per row. The API's `id` is NOT unique (id 42 appears twice), so never track by it. */
  key: string;
  id: number | null;
  name: string | null;
  status: OrgStatus;
  memberCount: number | null;
  ownerEmail: string | null;
  ownerEmailValid: boolean;
  createdAt: Date | null;
}

/** What the create form sends. Already validated and clean. */
export interface NewOrganisation {
  name: string;
  status: KnownStatus;
  ownerEmail: string;
  memberCount: number | null;
}