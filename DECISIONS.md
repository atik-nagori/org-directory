# DECISIONS

## Stack and setup
- Angular (standalone components, signals, new control flow, inject(), typed reactive forms), TypeScript strict mode.
- Plain CSS with custom properties as design tokens. Rejected: Angular Material / Tailwind, because they add weight and the brief asks for plain and legible.

## Design tokens (FR6)
- All colours, spacing, font sizes, radii and sizes are CSS custom properties in `src/styles/tokens.css`. Components only use `var(--...)`. Changing `--color-brand` re-themes the app.
- Border widths use a `--border-width` token too, so no raw `px` values appear in components.
- Rejected: Sass variables (needs a build step, can't change at runtime) and a CSS framework (extra weight, harder to explain live).
- Status colours were picked for at least 4.5:1 contrast on white (WCAG AA).

## Translations (FR5)
- All visible strings live in `src/app/core/i18n/en.json`, read through a small `I18nService` and a `t` pipe. Missing keys return the key and log a warning, so gaps are visible.
- Chose a bundled JSON import over loading JSON at runtime: no extra request, no flash of untranslated text, simpler to defend.
- Trade-off: switching language at runtime isn't built. With more time I'd lazy-load a JSON per locale and keep the active locale in a signal.
- Rejected: `@ngx-translate` and Angular's built-in i18n. Both add setup the brief doesn't need.

## Conflict 1: one page vs. API limits
## Mock API
- No backend. An Angular functional HTTP interceptor answers `/api/organisations` in the browser, so the app also works on static hosting. It never calls the network for that URL.
- Behaviour on the list request: 400-900 ms random delay, ~15% random 500 errors, maximum 25 records per request (a bigger `pageSize` is clamped to 25), and 5 list requests per rolling minute. Extra requests get a 429 with a `Retry-After` header.
- Random 500s count against the rate limit, like a real server. Rejected 429s do not.
- It also supports `POST` (create) with a 409 for duplicate names, case-insensitive.
- Rejected: json-server (needs a running server, breaks on Netlify/GitHub Pages) and MSW (extra dependency and service-worker setup).
- Limitation: data lives in memory, so created organisations disappear on reload.

## Fixture
- The 8 records from the brief are kept exactly as given and come first. A script (`scripts/generate-fixture.mjs`) adds 129 varied copies to reach 137, the number the API brief mentions.
- The variants keep the quirks: empty and null names, mixed-case status, typo and null status, numbers as strings, negative and null counts, missing owner, invalid email, epoch dates, an invalid date, duplicate ids, Arabic with emoji, long names. I added names that differ only by case (to test the unique check) and date-only strings.
- The script uses a fixed seed, so the output is identical on every run.

## Conflict 2: status dot vs. accessibility
_(to be filled in Phase 4)_

## Fixture data quirks
_(to be filled in Phase 3)_

## Assumptions
- The "137 records total" in the API brief is the fixture size; I generated exactly 137.

## AI tool declaration
- I used Claude as a pair-programming assistant throughout this project.
- Claude drafted: _(update per phase)_
- I reviewed, ran and modified: _(update per phase)_
- I can explain and extend every file in this repo without AI assistance.

- Phase 0: Claude gave the setup commands, the strict-mode fix, the DECISIONS.md skeleton, and helped debug Git and authentication errors.

- Phase 1: Claude drafted the tokens file, the i18n service/pipe and the app shell. I ran it and checked that changing a token and a string updates the UI.
- Phase 2: Claude drafted the fixture generator and the mock API interceptor. I ran it, read through the generated JSON, and tested the 25-record limit, the 500 errors and the 429 response from the console.