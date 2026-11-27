# Sanad — notes for Claude Code

Desktop app (Electron + React/Vite + SQLite via built-in `node:sqlite`) for promissory notes (سند لأمر) printed from numbered books.

## Rules
- Arabic text: no tashkeel at all (no tanween, shadda, harakat) — in UI strings, print template and code.
- Every UI string lives in `src/i18n.js` in both `ar` and `en`.
- The printed note is Arabic only (legal document); its text mirrors the client's paper form.
- Small, clear commits.

## Commands
- `npm run dev` — Vite on :5173 + Electron
- `npm test` — node:test (Node 22.13+, uses built-in `node:sqlite`)
- `npm run test:e2e` — builds, then drives the real Electron app with playwright-core (`e2e/app.test.mjs`).
  Uses a throw-away data folder (`SANAD_USER_DATA`) and catches preview PDFs (`SANAD_PREVIEW_DIR`).
  On Linux without a screen: `xvfb-run -a npm run test:e2e`.
- `npm run dist:zip` — portable Windows zip (works from Linux too)
- `npm run dist` — Windows installer in `release/`
- `npx vite` alone opens the UI in a browser using `src/mockApi.js` (no Electron) — handy for layout work;
  `http://localhost:5173/#/print/1` shows the print template.

## Architecture
- `electron/db.cjs` — all SQL. Numbering: `createVoucher` takes `MAX(seq)+1` inside a transaction,
  refuses past `book.count`, closes the book on the last number. Cancelled notes keep their number.
- `electron/main.cjs` — IPC handlers return `{ ok, data | error }`; errors are codes like `BOOK_FULL`
  translated in `i18n.js` as `err_<CODE>`.
- `src/api.js` unwraps the result and throws `Error(code)`.
- `src/print/VoucherPrint.jsx` — `VoucherSheet` is the print template (mm units), also used for the live
  preview in Settings. The print window calls `api.printReady()` once fonts and images load.

## Licensing (ElevaHub)
- `electron/licensing/*` — fingerprint (`snd_…` from the OS machine id), signed `desktop` documents (Ed25519,
  same format as ElevaHub), trial / active / locked rules, clock high-water mark. Design: ElevaHub
  `docs/DESKTOP-LICENSING.md`.
- `electron/license-config.json` — `apiUrl` (license-api Worker host, NOT the Hub URL) and `publicKeys`.
  Empty `apiUrl` = licensing off. `npm run dist` refuses an empty config or the test key
  (`SANAD_ALLOW_UNLICENSED=1` to override).
- Locked: writes and printing refused in `main.cjs` (`LICENSE_LOCKED`); backups still work; restore keeps
  the license rows.
- Env for tests: `SANAD_LICENSE_API`, `SANAD_LICENSE_KEYS`, `SANAD_FINGERPRINT`, `SANAD_HOSTNAME`;
  `e2e/licenseServer.mjs` is a fake Worker.

## UI components (no native form controls)
- `src/components/Select.jsx` — combobox/listbox, keyboard (arrows, Home/End, Enter, Escape, type-ahead).
- `src/components/DateInput.jsx` — type dd/mm/yyyy (Arabic digits OK) or pick from a calendar that shows
  the Hijri day under each date; week starts Sunday; arrow keys mirrored in RTL. Logic in `src/lib/calendar.js`.
- `src/components/Switch.jsx` — replaces checkboxes.
- `src/components/ui.jsx` — PageHeader, Section, Field (a div, so popover clicks are not re-sent like a label),
  Alert, EmptyState, IconButton, toasts (`useToast`), `Ltr` (keeps numbers/dates in order inside Arabic text).
- Give every control a `testId` / `data-testid` the e2e tests can target.
