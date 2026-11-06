// Generates the 137-record fixture. Run from the project root:
//   node scripts/generate-fixture.mjs
import { mkdirSync, writeFileSync } from 'node:fs';

const OUTPUT = 'src/app/core/mock-api/organisations.json';
const TOTAL = 137;
const DAY = 86_400_000;

// The 8 records from the brief, copied exactly. Do not clean them.
const seeds = [
  { id: 1, name: 'Northwind Traders', status: 'active', memberCount: 42,
    owner: { email: 'ops@northwind.example' }, createdAt: '2024-03-11T09:12:00Z' },
  { id: 2, name: '', status: 'ACTIVE', memberCount: '12',
    owner: { email: 'a@b.example' }, createdAt: 1710150720000 },
  { id: 3, name: null, status: 'Active', memberCount: -1, createdAt: '2024-01-02T00:00:00Z' },
  { id: 42, name: 'Globex Corporation', status: 'suspended', memberCount: 7,
    owner: { email: 'hq@globex.example' }, createdAt: '2023-11-30T14:45:10Z' },
  { id: 42, name: 'Globex Corporation Ltd', status: 'actve', memberCount: 7,
    owner: { email: 'hq@globex.example' }, createdAt: '2023-11-30T14:45:10Z' },
  { id: 6, name: 'شركة الأمل 🚀', status: 'active', memberCount: 3,
    owner: { email: 'info@amal.example' }, createdAt: '2025-06-01T08:00:00Z' },
  { id: 7,
    name: 'The Very Long Organisation Name That Somebody Actually Typed Into The Field Because Nobody Validated It And It Keeps Going Well Past Any Reasonable Column Width And Still Has Not Stopped',
    status: 'inactive', memberCount: 0,
    owner: { email: 'long@example.com' }, createdAt: '2024-07-19T16:20:00Z' },
  { id: 8, name: 'Initech', status: null, memberCount: null,
    owner: { email: 'not-an-email' }, createdAt: 'not a date' },
];

// Small deterministic random generator, so every run gives the same file.
let state = 20241106;
function random() {
  state = (state * 1664525 + 1013904223) % 4294967296;
  return state / 4294967296;
}
const pick = (list) => list[Math.floor(random() * list.length)];

const words = ['Acme', 'Umbrella', 'Hooli', 'Stark', 'Wayne', 'Wonka', 'Soylent', 'Vandelay',
  'Cyberdyne', 'Tyrell', 'Oscorp', 'Aperture', 'Gringotts', 'Prestige', 'Sterling', 'Monarch'];
const suffixes = ['Ltd', 'Group', 'Holdings', 'Labs', 'Partners', 'Industries', 'Co', 'Systems'];
const statuses = ['active', 'active', 'active', 'inactive', 'suspended',
  'ACTIVE', 'Active', 'Suspended', 'INACTIVE'];

const usedNames = [];

function makeName(seed, n) {
  if (typeof seed.name !== 'string' || seed.name === '') return seed.name; // keep "" and null
  if (seed.name.length > 100) return seed.name.slice(0, 90 + Math.floor(random() * 100));
  if (/[^\x00-\x7F]/.test(seed.name)) return `${seed.name} ${n}`; // keep Arabic and emoji
  let name = `${pick(words)} ${pick(suffixes)}`;
  if (usedNames.includes(name)) name = `${name} ${n}`;
  usedNames.push(name);
  return name;
}

function vary(seed, n) {
  const copy = structuredClone(seed);
  copy.id = 100 + n;
  copy.name = makeName(seed, n);

  // Names that differ only by case, to test the case-insensitive unique check.
  if (n % 17 === 0 && typeof copy.name === 'string' && copy.name !== '' && usedNames.length > 0) {
    copy.name = pick(usedNames).toUpperCase();
  }

  // Keep the typo and the null status. Everything else gets a valid status in mixed case.
  if (typeof seed.status === 'string' && seed.status !== 'actve') copy.status = pick(statuses);

  if (typeof seed.memberCount === 'number' && seed.memberCount >= 0) {
    copy.memberCount = Math.floor(random() * 500);
  } else if (typeof seed.memberCount === 'string') {
    copy.memberCount = String(Math.floor(random() * 500)); // numbers stored as strings
  }

  if (copy.owner && copy.owner.email.includes('@')) {
    copy.owner = { email: `contact${n}@org${n}.example` };
  }

  const offset = Math.floor(random() * 900) * DAY;
  if (typeof seed.createdAt === 'number') {
    copy.createdAt = seed.createdAt - offset; // epoch milliseconds
  } else if (!Number.isNaN(Date.parse(seed.createdAt))) {
    const iso = new Date(Date.parse('2025-09-01T00:00:00Z') - offset).toISOString();
    copy.createdAt = n % 11 === 0 ? iso.slice(0, 10) : iso.replace('.000Z', 'Z'); // some date-only
  } // "not a date" stays as it is

  if (n % 23 === 0) copy.id = seed.id; // more duplicate ids, like the id 42 pair
  return copy;
}

const records = [...seeds];
for (let n = 0; records.length < TOTAL; n++) {
  records.push(vary(seeds[n % seeds.length], n));
}

mkdirSync('src/app/core/mock-api', { recursive: true });
writeFileSync(OUTPUT, JSON.stringify(records, null, 2) + '\n');

const ids = records.map((r) => r.id);
console.log(`Wrote ${records.length} records to ${OUTPUT}`);
console.log(`Unique ids: ${new Set(ids).size} (duplicates are deliberate)`);