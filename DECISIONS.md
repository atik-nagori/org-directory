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
- The conflict: ops wants everything on one page with no pagination. The API gives max 25 records per request, 137 total, and 5 requests per minute. 137 / 25 = 6 requests, so the full list cannot arrive within one minute.
- Chose: no pagination UI. Page 1 loads and shows immediately. The other pages load in the background, one at a time, and the list grows. A progress line shows "Loaded X of 137", and a countdown shows while the loader waits for the rate limit to reset. Search and sort work on whatever has loaded.
- How: the loader remembers when each request was sent and waits before the 6th one. If the server still answers 429, it waits for `Retry-After` and retries the same page. A page that fails with a 500 is recorded and can be retried alone without reloading the rest.
- Gave up: the full list is not instant. The 6th page arrives about a minute after the first, and the list isn't complete before then. Search and filter results can be incomplete until it is.
- Also gave up: the unique-name check on the create form only knows the names loaded so far. The server is the final check (it returns 409 on a duplicate), and the form shows that error.
- Rejected: classic pagination (breaks the "one page" requirement), infinite scroll (still needs the same rate-limit handling and hides records from search), and firing all 6 requests at once (the 6th is guaranteed to get a 429).

## Fixture data quirks
All cleaning happens in one function, `toOrganisation` in `organisation.mapper.ts`. The UI only sees clean, typed data.
- Empty or null name: becomes `null`, the UI shows "Unnamed organisation".
- Status in mixed case (`ACTIVE`, `Active`): lowercased and trimmed.
- Status typo (`actve`) or null: becomes `unknown`. I did not guess that "actve" means "active". A wrong guess would hide bad data from the ops team, and an explicit "Unknown" is honest.
- Member count as a string (`"12"`): converted to a number. Negative, null or non-integer values become `null` and show "—".
- Missing owner: `null`, shows "—".
- Invalid email (`not-an-email`): kept as text but flagged `ownerEmailValid: false`, so it won't become a mailto link.
- Dates as ISO strings or epoch milliseconds: both become `Date`. `"not a date"` becomes `null`, shows "—" and sorts last.
- Duplicate ids (id 42 twice): `id` is not used as a key. Each row gets a key from its position in the full list.
- The messiest quirk, for the video: the duplicate id. It silently breaks `@for` tracking and any "find by id" logic, and nothing warns you.
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
- The conflict: the designer wants a coloured dot only, no text. The accessibility standard says information must never be conveyed by colour alone.
- Chose: a coloured dot **plus a visible text label** ("● Active"). The dot stays, so the designer still gets the visual cue. The word makes the status readable for colour-blind users and for anyone on a poor screen.
- Gave up: some table compactness and the designer's "dot only" look.
- Rejected: a visually hidden label with a dot (screen readers are fine, but sighted colour-blind users would still see only a colour), and a tooltip only (not available on touch or keyboard).
- The dot is `aria-hidden`, so screen readers hear the status once.
- Status colours were also chosen for at least 4.5:1 contrast on white.

## List and table
- Sorting is client-side with signals. Name sort uses `Intl.Collator` (case-insensitive, handles accents and numbers). Missing names and invalid dates always sort last, in both directions, so unusable rows never lead the list. Sorting is stable, so ties keep the API order.
- The sort is a `computed`, so it re-sorts automatically when background pages arrive.
- Sort buttons live inside the column headers and use `aria-sort`, so screen readers announce the sort state.
- `@for` tracks by the generated `key`, not `id`, because the API has duplicate ids.
- Long names: one line with an ellipsis, plus a tooltip with the full name. Trade-off: tooltips don't work on touch or keyboard. With more time I'd add an expandable row. Rejected: wrapping, because one 200-character name would make a single row very tall.
- Arabic and mixed text: `dir="auto"` on the name, so each name picks its own direction. Layout uses `text-align: start` and logical alignment, not left/right.
- Dates are displayed in UTC. Some values are date-only strings, and local time could show them a day early in some time zones.
- Valid owner emails are `mailto:` links. Invalid emails are shown as plain text with a warning symbol and hidden text for screen readers, so the warning is not colour alone.

## Fixture data quirks
_(to be filled in Phase 3)_

## Assumptions
- The "137 records total" in the API brief is the fixture size; I generated exactly 137.
- Unknown or typo statuses are shown as "Unknown" rather than corrected or hidden.
- The loader imports the API limits (25 per page, 5 per minute) from the mock API file. In a real app they would come from config or the API itself.
- Unnamed organisations and missing values still appear in the list. I did not hide bad data from ops, I made it visible.

## AI tool declaration
- I used Claude as a pair-programming assistant throughout this project.
- Claude drafted: _(update per phase)_
- I reviewed, ran and modified: _(update per phase)_
- I can explain and extend every file in this repo without AI assistance.

- Phase 0: Claude gave the setup commands, the strict-mode fix, the DECISIONS.md skeleton, and helped debug Git and authentication errors.

- Phase 1: Claude drafted the tokens file, the i18n service/pipe and the app shell. I ran it and checked that changing a token and a string updates the UI.
- Phase 2: Claude drafted the fixture generator and the mock API interceptor. I ran it, read through the generated JSON, and tested the 25-record limit, the 500 errors and the 429 response from the console.
- Phase 3: Claude drafted the model, the mapper and the store. I ran it, checked the first 8 rows against the fixture, watched the rate-limit countdown, and tested retrying a failed page.
- Phase 4: Claude drafted the status badge, the list component and the table styles. I ran it and checked each quirk on screen: unnamed rows, Arabic, long names, bad email, bad date, duplicate ids, sorting and keyboard use.