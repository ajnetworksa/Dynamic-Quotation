# Change log: AI audit fixes

Branch: `ai-audit-fixes` (from the default branch). Date: 2026-10-16.
Rules followed: smallest safe change per item, no API shape or schema removals (one additive column), no behaviour change beyond the fix.

## How it was verified
- `npx tsc --noEmit`: clean.
- `npm run build` (Vite): succeeds.
- Ran `server.ts` against a fresh database and called it with curl (results below).
- **Not verified:** the UI in a browser. Kanban, Dashboard, Login, Tracking and QuoteForm changes were type-checked and built but not clicked through. Please do a manual pass (checklist at the end).
- `npm ci --ignore-scripts` then `npm rebuild better-sqlite3` was needed to run the server in the audit sandbox.

## Server (`server.ts`)
| Change | Why | Verified |
|--------|-----|----------|
| `execFile` + `new URL()` validation for `POST /api/system/remote-url` | Shell command injection | `http://x; touch /tmp/pwned` → 400, file not created |
| `POST /api/system/update` returns 403 unless `ALLOW_SELF_UPDATE=true` | It runs `git reset --hard` / `npm install` / build on the live server | 403 by default |
| `GET /api/settings` now `requireAuth` | Leaked bank details, terms, images | no token → 401, token → 200 |
| `POST /api/translate` now `requireAuth` + 20,000 char cap | Open to anyone, can use paid key | no token → 401 |
| AI chat SQL guard: also blocks `sessions`, `system_logs`, `permission_groups`, `token`, `password`, `attach`, `load_extension`; non-admin must have a real `author_id = <id>` predicate and no `--`, `/*`, `OR`, `UNION`; SQL error text no longer returned | Cross-user/secret access via model-written SQL | regex logic unit-checked in node; not exercised against a live model |
| `isQuoteVisibleToUser` check on `PATCH /quotes/bulk-status`, `POST/PATCH /quotes/:id/status`, `PATCH /quotes/:id/followup`; single-status value validated against the allowed list; follow-up returns 404 for unknown quote | Any user could change any quote | non-owner user (no view-all) → 403 on all three; admin → 200 |
| multer `limits: { fileSize: 100 MB, files: 5 }` | Unbounded uploads in memory | not exercised |
| Restore ZIP: extract only the `quotes.db` entry by exact name; run `integrity_check` and require a `quotes` table on the uploaded DB before closing the live one; delete `-wal`/`-shm` before copying | Zip-slip, corrupt/foreign DB, stale WAL replay | not exercised (needs a real backup ZIP) |
| `/api/settings` SQL used `"smtpConfig"` double-quoted literals → 500 on current SQLite. Changed to single quotes | Pre-existing bug found while testing; Tracking's Excel export fetch depends on it | now 200 |
| Same double-quote fix in `UPDATE quotes SET status = 'Sent'` (email send) | Same bug | not exercised (needs SMTP) |
| Added `addColumnIfNotExists('quotes','footer','TEXT')` | Pre-existing bug: fresh databases have no `footer` column, so saving a quote returned 500 | create quote → 200 on a fresh DB |

## Repo hygiene
- `git rm --cached quotes_old.db` and `.vscode/` (files stay on disk, both already in `.gitignore`). **History is not rewritten**: see H-01.
- `Dockerfile`: `npm ci`; copy `src/pdf` into the runtime image (server imports it). Not built (no Docker in the sandbox).

## Frontend
| File | Change |
|------|--------|
| `src/components/KanbanBoard.tsx` | Card click now goes to `/quote?recall=<id>`; null-safe totals/dates; added Rejected and Cancelled columns, quotes with unknown/null status show under Draft; column totals; empty-state text; error banner (dismissible); rollback no longer shows the full-page spinner; move/reject buttons always visible on touch, shown on hover/focus on desktop; cards keyboard-operable (Enter/Space); `aria-label`s; reject (X) button for Draft/Sent |
| `src/App.tsx` | Fetch interceptor: token only on same-origin requests, preserves `Headers`, doesn't overwrite an explicit Authorization header, session expiry keeps the unsaved draft; right-click blocking no longer applies to inputs/textarea/select/contenteditable; catch-all route redirects to `/`; safe JSON read of cached user; manual logout clears token, user, draft and `currentQuoteId` |
| `src/lib/storage.ts` (new) | `readJson`, `getStoredUser`, `clearSessionStorage` |
| `src/components/{AIAssistant,CustomerDB,Dashboard,ProductDB,QuoteForm,Settings,SupplierDB,Tracking}.tsx` | `JSON.parse(localStorage.getItem('user') \|\| '{}')` → `getStoredUser()` |
| `src/components/ErrorBoundary.tsx` (new), `src/main.tsx` | Render errors show a "Something went wrong / Reload" panel instead of a white screen |
| `src/components/Dashboard.tsx` | 6-month chart built from the 1st of each month (fixes 29th-31st overflow); local-time month keys; win rate = (Accepted+Invoiced) / (Accepted+Invoiced+Rejected); ring now a conic gradient of the real percentage with an `aria-label`. **Behaviour change:** the win-rate number will differ from before (it used to be accepted / all documents) |
| `src/components/Tracking.tsx` | Status/follow-up/note saves check `res.ok` and report errors; Invoiced and Cancelled added to the row and bulk status dropdowns and badge colours; CSV export quotes every cell, neutralises `= + - @` formula starts, adds a UTF-8 BOM, uses CRLF; Excel VAT label uses the quote's `vat_rate` |
| `src/components/QuoteForm.tsx` | Ctrl+S now calls `recordQuote` (same validation as the Save button) through a ref that always sees current state; shortcuts only act on `/quote` (the form is always mounted, so before they fired on every page and Ctrl+P hijacked printing everywhere); Excel VAT label uses `vatRate` |
| `src/components/Login.tsx` | Labels bound to inputs, `autocomplete`, autofocus, `role="alert"`, show/hide password button, tolerant of non-JSON error responses (e.g. 429) |

## Not changed (deliberately), see `HANDOFF.md`
Everything marked Open in `FINDINGS.md`. The big ones: history purge of the leaked DB, shared money/rounding module, discount model, session hardening, pagination, soft delete, component splits.

## Manual test checklist (please run before merging)
1. Log in / out. Wrong password shows an error; show-password toggle works.
2. Kanban: open a card (should open that quote); move Draft → Sent; reject; a Rejected quote appears in its column; works on a phone width.
3. Dashboard: numbers load; win-rate ring matches the percentage; on a date late in the month the chart shows six distinct months.
4. Tracking: change a status (success and, as a restricted user, failure message); export CSV and open in Excel with Arabic text; Excel export shows the right VAT %.
5. Quote form: edit the date, press Ctrl+S: the new date is saved; press Ctrl+S on another page: nothing happens.
6. Restricted user cannot change another user's quote status (403).
7. Visit `/nonsense`: redirects to Dashboard.
8. `docker-compose up -d --build` starts and serves PDFs.
