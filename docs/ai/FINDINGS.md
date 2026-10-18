# Audit findings: Dynamic-Quotation

Source: static read of the code by three audits (quote form + PDF, app shell + dashboards, server + admin screens), 2026-10-16, then two rounds of fixes. Line numbers in the original findings were from the first commit and have moved.

Status legend: **Done** = fixed on branch `ai-audit-fixes` (see `CHANGELOG-AI.md`). **Partial** = part fixed. **Open** = not done, see `HANDOFF.md` (task id in brackets).

## 1. Security and data exposure

| # | Sev | Finding | Status |
|---|-----|---------|--------|
| S1 | Critical | `quotes_old.db` committed (176 customers + phones, 530 products, logo, session tokens, plaintext admin password). | **Partial**: untracked and ignored. It is still in git history, and any password matching it must be changed. Purging history needs a force-push [H-01] |
| S2 | Critical | AI assistant ran model-written SQL with a bypassable guard. | **Done**: SQL is checked, then run on a separate read-only connection whose `quotes` / `quote_items` / `customers` are filtered views (non-admins see only their own non-deleted quotes). 14 unit tests (`src/lib/aiQuery.test.ts`) |
| S3 | Critical | Command injection in `/api/system/remote-url`. | **Done** (`execFile` + URL validation) |
| S4 | High | Self-update endpoint ran git reset / npm install / build. | **Done** (off unless `ALLOW_SELF_UPDATE=true`) |
| S5 | High | `/api/settings` and every `/api/settings/:key` public. | **Done**: all settings need a login; sensitive keys need `canManageSettings`; SMTP password never returned |
| S6 | High | `/api/translate` open to anyone. | **Done** (auth + size cap) |
| S7 | High | Status / bulk-status / follow-up had no ownership check. | **Done**: need EDIT rights (`canEditQuote`); view-only shares cannot change a quote |
| S8 | High | Client trusted for totals and author. | **Done**: totals recomputed server-side with the shared money module; author forced unless admin / `canChangeAuthor` |
| S9 | High | Catalog mutations open to every user; price-sync validation; last-admin demotion. | **Done**: `canEditCatalog` permission (existing users migrated to keep access), price validation, last admin cannot be demoted |
| S10 | High | Seeded `admin123`; 4-char passwords. | **Done**: random first password (or `ADMIN_INITIAL_PASSWORD`), 10+ chars everywhere |
| S11 | High | Session weaknesses. | **Partial**: tokens stored hashed, revoked on password change/reset, per-account lockout, active-sessions list, TOTP 2FA, token sent only same-origin, draft wiped on logout. The token is still kept in `localStorage` [H-07] |
| S12 | High | Restore safety. | **Done**: integrity check, schema check, named-entry extraction, WAL/SHM cleanup, pre-restore snapshot, shared routine |
| S13 | Medium | multer limits. | **Done** (100 MB / 5 files). Magic-byte checks per route not added |
| S14 | Medium | E-mail send: any recipient, unescaped HTML. | **Done** |
| S15 | Medium | `/versions` `LIKE` matched other quotes; `AJ` hard-coded. | **Done** |
| S16 | Medium | SMTP password stored plaintext and returned. | **Done** (never returned; blank on save keeps the stored one). Still plaintext at rest in the DB |
| S17 | Medium | CSP disabled; raw error messages; limits. | **Done**: CSP enforced in production (inline theme script allowed by computed hash), DB error text hidden, request IDs, audit trail. Global rate limit default 5000 / 15 min, now configurable with `API_RATE_LIMIT_MAX` |
| S18 | Medium | Right-click / F12 blocking. | **Done** (removed) |

## 2. Logic bugs

| # | Finding | Status |
|---|---------|--------|
| L1 | Ctrl+S saved stale state / skipped validation; fired on every page | **Done** |
| L2 | Kanban card opened a blank quote | **Done** |
| L3 | Kanban crashes / missing columns / errors hidden | **Done** |
| L4 | `/api/settings` 500 (double-quoted SQL literals) | **Done** |
| L5 | Fresh DB had no `quotes.footer` column (saving failed) | **Done** |
| L6 | Email send status update SQL literal | **Done** |
| L7 | Discount not capped; both-mode ping-pong | **Done** (`computeTotals`) |
| L8 | Rounding differed between form, PDF, Excel, server | **Done** (`src/lib/money.ts`, tested) |
| L9 | VAT hard-coded 15% in Excel | **Done** |
| L10 | Currency hard-coded to SAR | **Done**: per-quote currency (form, PDF, diff viewer, dashboard) |
| L11 | Qty / price / markup / VAT not validated; priced lines without description dropped | **Done** |
| L12 | Profit ignored discount; no margin % | **Done** |
| L13 | Row edits and translations by index; stale closures | **Done** (ids + functional updates) |
| L14 | Draft handling | **Partial**: quota-safe write, unsaved-edit warning on recalled quotes, undo for all row operations. Draft key is still shared across tabs; the 600 ms "initial load" timer remains [H-16] |
| L15 | Status vocabulary inconsistent | **Done** (`src/lib/status.ts`) |
| L16 | Dashboard month loop, UTC keys, win rate, ring, revenue double counting | **Done** (Accepted + Invoiced, quote + its invoice counted once) |
| L17 | Tracking mutations ignored `res.ok` | **Done** |
| L18 | CSV export | **Done** |
| L19 | Tracking selection / paging / filter bugs | **Done** |
| L20 | Unknown routes blank | **Done** |
| L21 | No ErrorBoundary | **Done** |
| L22 | Unsafe `JSON.parse(localStorage...)` | **Done** |
| L23 | Fetch interceptor | **Done** |
| L24 | Logout left draft behind | **Done** |
| L25 | Excel export issues (`muFilters` case, missing qty) | **Done** |
| L26 | Quote-ID race | **Done**: 15-minute reservations |
| L27 | Recycle Bin dead code / hard delete | **Done**: soft delete, restore, pin, purge, daily prune |
| L28 | PDF fonts / footer / dates / keys / colours | **Done** (bundled Tajawal, footer from settings, local dates). Mixed-direction text still relies on the renderer's native bidi |
| L29 | Diff viewer | **Done** (matched items, more fields, dialog semantics, tests) |
| L30 | Profile modal reload | **Done** |
| L31 | Production deep links returned "Cannot GET /tracking" | **Done** (SPA fallback; found by the browser test) |
| L32 | Regression: the "Recycle Bin Auto-Clear" option (7/14/30/60/90 days / Never, setting `recycleBinDays`) existed on the `feat/bulk-export` branch / earlier build but was missing from Settings | **Done**: restored as a Recycle Bin card in Settings → Data & Backups; the Recycle Bin page shows the current retention |
| L33 | The daily prune turned "Never" (`0`) into 30 days, so quotes meant to be kept were deleted | **Done**: `src/lib/recycleBin.ts` (tested), 0 = never |

## 3. UI / UX / accessibility

| # | Finding | Status |
|---|---------|--------|
| U1 | Login labels, autocomplete, errors, show password | **Done** (+ 2FA code field) |
| U2 | Kanban touch / keyboard / totals / empty state | **Done** (+ drag and drop) |
| U3 | Win-rate ring | **Done** |
| U4 | `alert`/`confirm`, dialog semantics, aria-labels | **Done**: toasts + confirm/prompt dialogs, focus handling, Escape, aria-labels on icon buttons, keyboard-operable sortable headers and rows |
| U5 | Mobile | **Done**: no page-level horizontal scroll on phone widths (tested); quote form scrolls inside its own container |
| U6 | Dark mode | **Done**: `dark:` utilities follow the toggle, no flash, OS default. The old CSS overrides were kept (and extended), not rewritten |
| U7 | Loading / error / empty states | **Done** |
| U8 | Sortable headers | **Done** |
| U10 | Users & permissions screen cluttered (27 flat checkboxes, inline forms); Settings one long page of ~20 cards | **Done**: Users list with role filter, search, access meter; editor dialog with permissions grouped by category (All/None, search); Settings split into 6 sections with a sidebar (`/settings#section`) and a "Show everything" view. Same API calls and payloads |
| U9 | Arabic / RTL | **Partial**: English/Arabic toggle with RTL page direction for navigation, Kanban and Dashboard. Most other screens are still English only [H-26] |

## 4. Maintainability and ops

| # | Finding | Status |
|---|---------|--------|
| M1 | Giant components | **Partial**: `QuoteForm` 5,044 → ~4,500 lines (dialogs and totals panel extracted), `Settings` 3,386 → ~3,220 and split into sections (generic choice card, company details, encrypted backup, Recycle Bin card, section nav). Further splits [H-27] |
| M2 | Dockerfile missing `src/pdf` | **Done** (+ `src/lib`, `assets`) |
| M3 | Docker root user, no healthcheck, mounts | **Done**: entrypoint drops to the `node` user after fixing volume ownership, HEALTHCHECK on `/api/health`, backups mounted, clear error when the DB mount is a directory. Docker image itself could not be built in the sandbox (no daemon) |
| M4 | Missing DB indexes | **Done** |
| M5 | Full-table lists, per-row bulk delete | **Partial**: bulk delete endpoints (one transaction) wired in; `?page=&limit=&q=` available on customers/products; screens still load full lists (hundreds of rows) [H-29] |
| M6 | No tests / CI / React types | **Done**: 65 unit tests, 2 browser/API smoke scripts (53 + ~60 checks), GitHub Actions workflow, `@types/react` |
| M7 | Unused deps / package name | **Done** |
| M8 | `.vscode/` tracked | **Done** |

## 5. Features suggested in the first review

| # | Feature | Status |
|---|---------|--------|
| F1 | Client approval portal | **Done**: tokenised public link, PDF download, accept/decline with typed signature, tracking of views and response |
| F2 | Per-line discount / tax, optional items, section rows | **Open** [H-31] |
| F3 | Status workflow, reject reason, reminders, expiry alerts | **Done**: reject reason (stored and reported), follow-ups due and expiring offers on the dashboard. Transitions are not enforced |
| F4 | Drag-and-drop Kanban | **Done** |
| F5 | Dashboard range, aging, loss reasons | **Done** (margin chart not added) |
| F6 | Audit log | **Done** (viewer + automatic trail, 1-year retention) |
| F7 | 2FA, password reset, sessions list | **Partial**: TOTP 2FA and sessions list done; password reset by e-mail needs a user e-mail field [H-32] |
| F8 | CSV import with preview and duplicate detection | **Done** (customers, products) |
| F9 | Encrypted / off-site backups | **Partial**: passphrase-encrypted download + restore (AES-256-GCM). Automatic upload to cloud storage not added [H-33] |
| F10 | Payments, recurring invoices | **Done**: payments with balance and PDF "paid / due"; recurring schedules that generate Draft copies |
| F11 | Health, logging | **Done**: `/api/health`, request IDs, JSON logs. Hosted error tracking not added |
