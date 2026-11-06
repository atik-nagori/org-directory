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

## States (FR4)
- Loading, empty and error each use the same `StatePanel` component but look different: loading is a plain panel with a `…` icon, empty has a dashed border and `○`, error is red with `!` and a Retry button. They differ by border style and icon, not only colour.
- Error and warning use `role="alert"`; loading, empty and progress use `role="status"`, so screen readers announce changes.
- Retry calls the same `load()`, which skips pages already loaded. A failed first page retries page 1; a failed background page retries only the missing pages.
- A background failure does not replace the table with an error screen. The loaded rows stay visible and a warning banner offers a retry. Rejected: one big error state, because it would hide 100+ good records because of one failed page.
- Progress ("Loaded X of 137") and the rate-limit countdown are shown above the table. The countdown is outside the live region so a screen reader isn't interrupted every second.
- The empty state currently means "no data at all". The "no results for this search" variant comes with search and filter.
- Tested by temporarily changing the delay, failure rate and fixture in the mock API (reverted afterwards).
## Search and filter (FR2)
- The URL is the source of truth. `q` and `status` are read from the query params into signals (`toSignal` on `queryParamMap`), and changes are written back with `router.navigate` (merge, `replaceUrl`). A filtered view can be shared, reloaded and used with Back and Forward.
- Search is debounced by 300 ms with a plain `setTimeout`, cleared on every keystroke and on destroy. Rejected: an RxJS `Subject` with `debounceTime` (more code for one timer) and a `BehaviorSubject` (the brief says no BehaviorSubject for view state).
- `replaceUrl: true`, so typing and filtering don't fill the browser history with one entry per change. Trade-off: Back doesn't step through earlier filters.
- The search box follows the URL through a `linkedSignal`, so Back and Clear filters update it. It keeps the user's own text if it only differs by spaces, so typing "north wind" works.
- Matching is a case-insensitive "contains" on the name. Unnamed organisations never match a search, but they appear when there is no search text. Not done: accent-insensitive search and fuzzy matching.
- The status filter has an "Unknown" option, so the typo and null statuses can be found and cleaned up by ops. An invalid `status` in the URL is ignored and means "All".
- Filtering is client-side and runs on what has loaded so far (Conflict 1), so early results may be incomplete. The progress banner stays visible above the results, and the count updates as pages arrive.
- "No results" (data exists, filter matches nothing) is a different state from "no data at all", with its own message and a Clear filters button. The filter bar stays mounted so the search box keeps focus.
- The result count ("Showing X of Y loaded") appears only when a filter is active, in a `role="status"` region so screen readers hear it.

## Create form (FR3)
- The form is its own page (`/new`), not a panel on the list. It keeps the list component smaller, gives the form a URL, and is easy to extend live. Created organisations live in the store, so they survive navigation.
- Typed, non-nullable reactive form: every control has a default (`''`), so `reset()` never produces null. Member count is a text input that is converted to a number on submit. A `type="number"` control would be nullable.
- Errors show after blur (the control is "touched"), not while typing for the first time. After a blur they update live, so the message disappears as soon as the value is fixed. On submit, every field is marked as touched.
- The submit button is not the only signal. Four things tell the user something is wrong: an error summary at the top that takes focus and links to each field, a message under each field with a `!` icon, a thicker border on the field, and `aria-invalid` and `aria-describedby` for screen readers. The submit button is never disabled for an invalid form, because a disabled button hides the reason. It is only disabled while saving.
- Reactive forms are not signals, so `form.events` is converted with `toSignal` and the error messages are `computed`. Rejected: calling `control.hasError()` directly in the template (it depends on change detection).
- The name rules live in one custom validator that works on the trimmed value (required, 3-80, unique). Rejected: the built-in `minLength` (it counts leading and trailing spaces, so three spaces would be a valid name).
- Unique name, case-insensitive: compared against all names loaded so far. Because of Conflict 1, pages may still be loading, so the server also checks every record and answers 409. The form turns that into the same "already exists" message. Trade-off: for a short moment after opening the page, the check is server-only.
- The email check uses the same regex as the list mapper (`EMAIL_PATTERN`), so "valid" means the same thing everywhere. It is deliberately simple: one `@` and a dot in the domain. Rejected: Angular's `Validators.email`, which accepts `a@b`.
- Status options are the three known statuses. "Unknown" is not offered, because a new organisation should have a real status. Unknown exists only for bad legacy data.
- After success the form clears, shows a confirmation inside an always-present `role="status"` region, and moves focus back to Name, so ops can add several in a row.
- New organisations are shown at the top of the list, and are kept apart from the API rows. In the mock API they are stored separately from the paged fixture, so the total stays at 137 and a later page never repeats a created row. A real API would include them in the paged list.
- Not done: draft saving, a "discard changes?" prompt, and a loading state for the unique check. With more time I would add the unsaved-changes prompt.

## Accessibility
- Status is a dot plus a visible word; invalid fields have a thick border, a `!` icon and text, not just red; the three load states differ by border style, icon and wording. I checked the app in greyscale.
- Keyboard: every control is reachable, there is a skip link, and focus rings are visible. After an invalid submit, focus moves to the error summary, and each summary item jumps to its field.
- Screen readers: `aria-sort` on sortable columns, `aria-invalid` and `aria-describedby` on fields, `role="alert"` for errors and `role="status"` for progress, counts and success. The countdown is kept outside the live region so it isn't read out every second.
- Contrast: I changed the focus colour from orange (about 2.3:1 on white) to a darker red-brown (about 5.8:1), because focus indicators need at least 3:1. Text and status colours were picked for at least 4.5:1.
- Decorative symbols (`▲ ▼ ⚠ ! ✓ … ○`) are `aria-hidden`; the same meaning is always in translated text beside them, so they are not user-facing strings.
- Checked with Lighthouse and by hand (keyboard only, 200% zoom, greyscale). Not tested on a real range of screen readers or on a phone.
- Known gaps: long names are fully visible only in a `title` tooltip (not available on touch or keyboard); no `lang` attribute on mixed-language names; no reduced-motion handling needed because there are no animations.

## Cleanup and checks (FR5, FR6)
- Grepped the templates for English text and the CSS and TypeScript for hex colours and `px`/`rem` values. The only leftover string was the page title in `index.html`; it is now set from `en.json` with Angular's `Title` service. The disabled opacity became a token.
- Tests: only the mapper, because it is pure and holds every fixture quirk. Rejected: component tests and end-to-end tests, as the brief sets no coverage target and time was limited. I deleted the generated `app.spec.ts` because it tested the starter page.
## Deployment
- Hosted on Netlify from the GitHub repo; every push to `main` redeploys. The mock API runs in the browser, so no backend is needed.
- `netlify.toml` rewrites every path to `index.html` (status 200), so deep links such as `/new` and `/?status=active` work on reload. Without it, a shared filtered link would 404.
- Rejected: GitHub Pages (needs a base-href change and a 404.html workaround for deep links) and StackBlitz (slower, less reliable for a reviewer).
- Limitation: the mock data lives in memory, so created organisations disappear on reload, and the rate-limit counter resets on reload.


## Assumptions
- The "137 records total" in the API brief is the fixture size; I generated exactly 137.
- Unknown or typo statuses are shown as "Unknown" rather than corrected or hidden.
- The loader imports the API limits (25 per page, 5 per minute) from the mock API file. In a real app they would come from config or the API itself.
- Unnamed organisations and missing values still appear in the list. I did not hide bad data from ops, I made it visible.

- Member count is optional and must be a whole number, 0 or more. Decimals are rejected rather than rounded.
- Created organisations are in memory only and disappear on reload, like the rest of the mock API.

## With two more days
- Replace the name tooltip with an expandable row that works on touch and keyboard.
- Add an "unsaved changes" prompt on the create form.
- Load a JSON per locale and keep the active language in a signal; test the layout with a right-to-left language.
- Move the rate limit and page size into config, or read them from the API, instead of importing them from the mock.
- Add component tests for the list, the filters and the form.


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
- Phase 5: Claude drafted the state panel, the banners and the list template changes. I forced each state by changing the mock API settings, checked that they look different, and tested both retry paths.
- Phase 6: Claude drafted the URL-synced search and filter, the debounce and the filtered empty state. I tested typing, the status filter, shared URLs, an invalid status in the URL, Back button behaviour, and filtering while pages were still loading.

- Phase 7: Claude drafted the form component, the validators, the store changes and the mock API POST handling. I tested each rule and the blur behaviour, the error summary and its links, the case-insensitive duplicate, a valid submit, keyboard-only use, and the server 409 path.
- Phase 8: Claude suggested the sweep commands, the focus colour fix, the mapper tests and the README. I ran every sweep, ran Lighthouse, and did the keyboard, zoom and greyscale checks myself.
- Phase 9: Claude suggested the Netlify config and the SPA redirect. I deployed it, fixed any build issues from the log, and tested deep links on the live URL.