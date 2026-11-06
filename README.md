# Organisation Directory

A small Angular screen for finding organisations, checking their status and adding new ones.
Built for the KOTS front-end assessment.

## Run it

    npm install
    ng serve        # http://localhost:4200
    ng test --no-watch
    ng build

## How it works

- No backend. An HTTP interceptor (`src/app/core/mock-api`) serves a 137-record messy fixture with a
  400-900 ms delay, ~15% random failures, 25 records per request and 5 requests per minute.
- `organisation.mapper.ts` is the only place that knows how messy the data is. The UI only sees clean types.
- Search and status filter live in the URL: `/?q=north&status=active`.
- All text is in `src/app/core/i18n/en.json`. All colours and spacing are tokens in `src/styles/tokens.css`.

See `DECISIONS.md` for the two conflict resolutions, the fixture handling and the AI-tool declaration.