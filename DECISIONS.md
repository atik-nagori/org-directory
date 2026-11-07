# DECISIONS

## Conflict 1: one page vs. API limits

- **Problem:** ops wants everything on one page, no pagination. The API allows 25 records per request, 5 requests per minute, 137 records. That is 6 requests, so the full list cannot arrive within one minute.
- **Chose:** no pagination UI. Page 1 shows immediately. The other pages load in the background, one at a time, and the list grows. A progress line shows "Loaded X of 137" and a countdown shows while the loader waits for the rate limit to reset. Search and sort work on whatever has loaded.
- **How:** the loader remembers when each request was sent and waits before the 6th. If the server still answers 429, it waits for `Retry-After` and retries that page. A page that fails with a 500 is recorded and can be retried alone.
- **Gave up:** the list is not complete for about a minute, so early search and filter results can be incomplete. The unique-name check on the form only knows loaded names; the server (409) is the final check.
- **Rejected:** classic pagination (breaks "one page"), infinite scroll (same rate-limit problem, hides records from search), firing all 6 requests at once (the 6th always gets a 429).

## Conflict 2: status dot vs. accessibility

- **Problem:** designer wants a coloured dot only. The accessibility standard says information must never be conveyed by colour alone.
- **Chose:** a coloured dot plus a visible text label ("● Active"). The designer keeps the dot; colour-blind users get the word. The dot is `aria-hidden`, so screen readers hear the status once.
- **Gave up:** some table compactness and the dot-only look.
- **Rejected:** a dot with a visually hidden label (sighted colour-blind users still see only colour) and a tooltip (no touch or keyboard access).

## Fixture quirks

All cleaning is in one function, `toOrganisation` in `organisation.mapper.ts`. The UI only sees clean, typed data.

- Empty or null name: `null`, shown as "Unnamed organisation".
- Mixed-case status (`ACTIVE`, `Active`): lowercased.
- Typo (`actve`) or null status: `unknown`. I did not guess "active"; a wrong guess would hide bad data from ops.
- Member count as string (`"12"`): converted. Negative, null or non-integer: `null`, shown as "—".
- Missing owner: `null`, shown as "—". Invalid email: shown as plain text with a warning, not a mailto link.
- Epoch and ISO dates: both become `Date`. `"not a date"`: `null`, shown as "—", sorted last.
- **Messiest: duplicate id 42.** Two organisations share one id and nothing warns you; it silently breaks `@for` tracking and any find-by-id logic. Rows get a key from their position in the full list and the template tracks by that key.
- Long names: one line with ellipsis and a tooltip. Arabic and emoji: `dir="auto"`.

## Other decisions

- **Stack:** standalone components, signals, `@if/@for/@switch`, `inject()`, typed non-nullable reactive forms, strict mode. Plain CSS. Rejected Material and Tailwind (extra weight, brief asks for plain).
- **Design tokens (FR6):** all colours, spacing, sizes and radii are CSS custom properties in `src/styles/tokens.css`. Changing `--color-brand` re-themes the app. Rejected Sass variables (build step, not changeable at runtime).
- **Translations (FR5):** all visible strings are in `en.json`, read through an `I18nService` and a `t` pipe. A missing key returns the key and logs a warning. Rejected `@ngx-translate` and Angular i18n (more setup than needed). Not built: runtime language switching.
- **Mock API:** an HTTP interceptor answers `/api/organisations` in the browser (400-900 ms delay, ~15% random 500s, max 25 per request, 5 per minute with 429 and `Retry-After`; POST with 409 for duplicate names). Rejected json-server (needs a server, breaks on static hosting) and MSW (extra setup). Data is in memory and resets on reload.
- **Fixture:** the 8 brief records are kept exactly and come first. `scripts/generate-fixture.mjs` adds 129 varied copies (fixed seed) to reach 137, keeping every quirk, plus names that differ only by case and date-only strings.
- **List:** client-side sort with signals; names use `Intl.Collator`; missing names and dates always sort last. Dates are shown in UTC because some values are date-only.
- **States (FR4):** loading, empty and error share one panel but differ by border style, icon and wording, not only colour. A failed background page shows a warning banner with retry and keeps the loaded rows, instead of replacing the table with an error.
- **Search and filter (FR2):** the URL is the source of truth (`?q=&status=`), read with `toSignal` and written with `router.navigate` (merge, `replaceUrl`). Debounce is a plain 300 ms `setTimeout`. Rejected an RxJS subject for one timer. "No results" is a different state from "no data". The status filter includes "Unknown" so bad data can be found.
- **Create form (FR3):** its own page (`/new`). Errors show after blur; submit marks all fields touched. The submit button is not the only signal: a focused error summary linking to each field, a message with an icon under each field, a thicker border, and `aria-invalid` / `aria-describedby`. The button is never disabled for invalid input. One custom name validator on the trimmed value (required, 3-80, unique, case-insensitive). The email check shares the mapper's regex. Rejected `Validators.email` (accepts `a@b`).
- **Accessibility:** keyboard-only use, skip link, visible focus. I changed the focus colour from orange (about 2.3:1 on white) to a darker one (about 5.8:1), because focus indicators need 3:1. `aria-sort` on sortable columns, live regions for errors and progress, countdown kept outside the live region.
- **Tests:** only the mapper, because it is pure and holds every fixture quirk. No coverage target was set.
- **Deployment:** Netlify from GitHub. `netlify.toml` rewrites all paths to `index.html` so deep links like `/new` and `/?status=active` work on reload. Rejected GitHub Pages (base-href and 404 workaround).

## Assumptions

- The brief says "see R3 below", but my copy has no R3 section. I assumed it concerns tests or quality and added mapper tests.
- The brief says 2 days in the email and 72 hours in the document; I worked to the earlier one.
- "137 records total" is the fixture size, so I generated exactly 137.
- Typo and unknown statuses show as "Unknown" rather than being corrected or hidden. Unnamed and incomplete rows stay visible.
- Member count is optional and must be a whole number, 0 or more; decimals are rejected, not rounded.
- Created organisations are in memory only and appear at the top of the list.
- The loader imports page size and rate limit from the mock; in a real app they would come from config or the API.

## With two more days

- Replace the name tooltip with an expandable row that works on touch and keyboard (known accessibility gap).
- Add an "unsaved changes" prompt on the create form.
- Load one JSON per locale, keep the language in a signal, and test right-to-left layout.
- Add component tests for the list, filters and form.

## AI tool declaration

- I used Claude as a pair-programming assistant for the whole project, in phases.
- Claude drafted the first version of the fixture generator, mock API, mapper, store, list, status badge, state panel, search and filter, create form, mapper tests, README and Netlify config.
- I ran and tested every phase, forced each state and error path, checked the quirks on screen, did the keyboard, zoom and greyscale checks, fixed the problems that came up (for example a template variable that shadowed a signal), and made all commits and the deployment.
- I can explain and extend every file in this repo without AI assistance.
