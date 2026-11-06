import { toOrganisation } from './organisation.mapper';

describe('toOrganisation', () => {
  it('turns an empty or null name into null', () => {
    expect(toOrganisation({ name: '' }, 0).name).toBeNull();
    expect(toOrganisation({ name: null }, 0).name).toBeNull();
  });

  it('lowercases mixed-case statuses', () => {
    expect(toOrganisation({ status: 'ACTIVE' }, 0).status).toBe('active');
    expect(toOrganisation({ status: 'Active' }, 0).status).toBe('active');
  });

  it('marks a typo or null status as unknown instead of guessing', () => {
    expect(toOrganisation({ status: 'actve' }, 0).status).toBe('unknown');
    expect(toOrganisation({ status: null }, 0).status).toBe('unknown');
  });

  it('converts member counts and rejects invalid ones', () => {
    expect(toOrganisation({ memberCount: '12' }, 0).memberCount).toBe(12);
    expect(toOrganisation({ memberCount: -1 }, 0).memberCount).toBeNull();
    expect(toOrganisation({ memberCount: null }, 0).memberCount).toBeNull();
  });

  it('handles a missing owner and flags an invalid email', () => {
    expect(toOrganisation({}, 0).ownerEmail).toBeNull();
    const bad = toOrganisation({ owner: { email: 'not-an-email' } }, 0);
    expect(bad.ownerEmail).toBe('not-an-email');
    expect(bad.ownerEmailValid).toBe(false);
  });

  it('reads ISO dates and epoch milliseconds, and rejects bad dates', () => {
    expect(toOrganisation({ createdAt: 1710150720000 }, 0).createdAt).toEqual(new Date(1710150720000));
    expect(toOrganisation({ createdAt: '2024-03-11T09:12:00Z' }, 0).createdAt).not.toBeNull();
    expect(toOrganisation({ createdAt: 'not a date' }, 0).createdAt).toBeNull();
  });

  it('gives two records with the same id different keys', () => {
    const first = toOrganisation({ id: 42 }, 3);
    const second = toOrganisation({ id: 42 }, 4);
    expect(first.id).toBe(second.id);
    expect(first.key).not.toBe(second.key);
  });
});