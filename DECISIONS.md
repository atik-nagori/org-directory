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
_(to be filled in Phase 3)_

## Conflict 2: status dot vs. accessibility
_(to be filled in Phase 4)_

## Fixture data quirks
_(to be filled in Phase 3)_

## Assumptions
_(running list)_

## AI tool declaration
- I used Claude as a pair-programming assistant throughout this project.
- Claude drafted: _(update per phase)_
- I reviewed, ran and modified: _(update per phase)_
- I can explain and extend every file in this repo without AI assistance.

- Phase 0: Claude gave the setup commands, the strict-mode fix, the DECISIONS.md skeleton, and helped debug Git and authentication errors.

- Phase 1: Claude drafted the tokens file, the i18n service/pipe and the app shell. I ran it and checked that changing a token and a string updates the UI.