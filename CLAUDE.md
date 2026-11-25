# Sanad — notes for Claude Code

Desktop app (Electron + React/Vite + SQLite) for promissory notes (سند لأمر) printed from numbered books.

## Rules
- Arabic text: no tashkeel at all (no tanween, shadda, harakat) — in UI strings, print template and code.
- Every UI string lives in `src/i18n.js` in both `ar` and `en`.
- The printed note is Arabic only (legal document); its text mirrors the client's paper form.
- Small, clear commits.

## Commands
- `npm run dev` — Vite on :5173 + Electron
- `npm test` — node:test (needs better-sqlite3 built for Node: `npm rebuild better-sqlite3`)
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
