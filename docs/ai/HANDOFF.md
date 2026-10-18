# Handoff: remaining work for another AI

Read `FINDINGS.md` (what is wrong) and `CHANGELOG-AI.md` (what is already fixed) first. Branch: `ai-audit-fixes`.

## Ground rules
- Stack: React 19 + TypeScript + Vite + Tailwind v4 (frontend, `src/`), Express + better-sqlite3 (`server.ts`, one 3,500-line file), `@react-pdf/renderer` for PDFs (`src/pdf/quote-document.tsx`).
- Do not break existing data: schema changes must be additive (`addColumnIfNotExists` in `server.ts`), never rename or drop columns. Existing deployments hold real data.
- Quote IDs are strings like `AJ-12345`; `quote_items.quote_id` references them as text.
- Setup: `npm ci --ignore-scripts && npm rebuild better-sqlite3`. Check: `npx tsc --noEmit` and `npm run build`. Run the server from a scratch dir so it doesn't create `quotes.db` in the repo: `cd /tmp/x && PORT=3999 NODE_ENV=production /path/to/repo/node_modules/.bin/tsx /path/to/repo/server.ts`. Default login `admin` / `admin123` on a fresh DB.
- `@types/react` is not installed (React is typed as `any`). Don't "fix" that in the same change as logic fixes (it will surface many type errors).
- The app is always mounting `QuoteForm` (hidden when not on `/quote`), see `src/App.tsx`. Global listeners in it must check the path.
- Every API call goes through a global `fetch` wrapper in `App.tsx` that adds the Bearer token, so components don't need to add it.
- One commit per task. Add a line to `CHANGELOG-AI.md` and flip the status in `FINDINGS.md` for each task.
- No test suite exists. Add one (H-30) before large refactors if you can.

Task format: **Goal / Files / Steps / Done when / Risks.**

---

## A. Security (do these first)

### H-01 Purge the leaked database from git history and rotate secrets
- Goal: `quotes_old.db` (176 customers + phones, 530 products, 3 session tokens, plaintext `admin123`) is no longer reachable in git history.
- Files: git history, `.gitignore`.
- Steps: (1) Tell the owner this rewrites history and everyone must re-clone. (2) `git filter-repo --path quotes_old.db --invert-paths` (also `--path .vscode --invert-paths` if wanted) on a fresh mirror clone. (3) Force-push after the owner agrees. (4) On any server that ever used this DB: change the `admin` password, delete all rows in `sessions`. (5) Treat the customer list as disclosed (inform affected people if required by law/contract).
- Done when: `git log --all -- quotes_old.db` is empty on the remote.
- Risks: destructive; needs explicit owner approval. Forks and clones keep the data.

### H-02 Replace free-form AI SQL with safe queries
- Goal: the AI assistant can only read the caller's permitted data.
- Files: `server.ts` (`/api/ai/chat`, around the "Critical Security Guardrails" block), `src/components/AIAssistant.tsx`.
- Steps: preferred: define 8-10 fixed parameterised queries (top customers, totals by status/month, quotes for customer X, item search) and have the model choose one by name + parameters (JSON), with the author filter added in code. If text-to-SQL must stay: open a second connection `new Database('quotes.db', { readonly: true })`, create TEMP views of only `quotes`, `quote_items`, `customers` already filtered by `author_id` for non-admins, run the model SQL only against those views, enforce a single `SELECT` via an allow-list parser, add `LIMIT`, add per-user rate limiting. Don't return raw `rows` unless needed.
- Done when: a non-admin cannot read another user's quote or any other table by any prompt; tested with injection prompts.
- Risks: behaviour change in what the assistant can answer.

### H-03 Public settings allow-list
- Goal: `/api/settings/:key` (public) serves only keys needed before login.
- Files: `server.ts` (`app.get('/api/settings/:key'`), `src/components/Login.tsx` and anything fetching settings pre-login.
- Steps: define `PUBLIC_SETTING_KEYS` (e.g. logo, branding, theme). Everything else requires auth. Search `src` for `/api/settings/` callers to confirm which are used before login (QuoteForm fetches many; they run after login).
- Done when: unauthenticated requests for bank details/terms return 401; login page still renders.

### H-04 Server-side authorization and trusting the client
- Goal: server enforces permissions and recomputes money.
- Files: `server.ts` (`POST /api/quotes`, `PATCH /quotes/*`, undo route), `src/components/{Kanban,Dashboard,Tracking}.tsx`.
- Steps: (1) On save, ignore client `author_id`/`author_name` for existing quotes and for non-admins; recompute `subtotal`, `tax`, `grand_total` from items + discount + vat (reuse the shared money module from H-12). (2) Edit rights: status/follow-up currently allow anyone who can *see* a quote; respect view-only shares (`shared_with` has per-target edit permission: see how `performSave` checks it near `shared_with` parsing in `POST /api/quotes`). (3) Enforce `canUseKanban`, `canViewRevenue`, `canOverridePrice` in the API; strip cost/profit fields from responses for users lacking `canViewRevenue`. (4) The undo route builds `UPDATE` column names from stored JSON: whitelist column names.
- Done when: a crafted request cannot change another user's quote, author, or totals.

### H-05 Authorization on product/customer/supplier mutations and last-admin guard
- Files: `server.ts` (`/api/products`, `/api/customers`, `/api/suppliers`, `/api/price-sync/apply`, `PUT/DELETE /api/users/:id`).
- Steps: add permission checks (e.g. new `canEditCatalog`, default true for existing users to avoid lockout); validate `new_price` is a finite number >= 0; block demoting/deleting the last admin on PUT as well as DELETE; handle not-found on user delete (currently throws).

### H-06 Initial admin password and password policy
- Files: `server.ts` (seed near "Default admin created", zod schemas with `min(4)`), `src/App.tsx` ChangePassword modal, `src/components/UsersDB.tsx`.
- Steps: on first boot generate a random password, print once to the console and set `must_change_password` (additive column); require 10+ chars; show the rule in the UI.
- Risks: existing installs keep working; only fresh installs change.

### H-07 Session hardening
- Files: `server.ts` (login, `sessions` table, logout, password change/reset), `src/App.tsx`, `src/components/Login.tsx`.
- Steps: store `sha256(token)` in `sessions` (migrate: hash on lookup, accept old rows once or force re-login); delete all of a user's other sessions on password change/reset; per-username login lockout; when "Remember me" is off, store the token in `sessionStorage` (the fetch wrapper and every `localStorage.getItem('token')` call need updating: grep for it); optional move to httpOnly cookie + CSRF token; add `storage` event listener so logout syncs across tabs; session-expiry warning.

### H-08 Restore/import and uploads, remaining parts
- Files: `server.ts` (`/api/admin/restore-zip`, `/api/db/import`, `/api/rfq/parse`, price-sync routes, multer).
- Steps: take a timestamped snapshot into `backups/` before swapping the DB; block other requests during restore; `db/import` should validate schema and run inside one transaction with FK-safe order; check magic bytes and MIME for PDF/Excel/ZIP uploads; per-route upload limits; record restore/import/export in `activity_log`.

### H-09 Email sending and version lookup
- Files: `server.ts` (`/api/quotes/:id/send` ~L1551, `/api/quotes/:id/versions`).
- Steps: validate `to` as an email, cap recipients, escape HTML in the body, default `body`; use `quote_id = ? OR quote_id LIKE ? ESCAPE` with an exact base-ID rule instead of `LIKE 'AJ-123%'`; read the ID prefix from settings instead of hardcoded `AJ`.

### H-10 Secrets and headers
- Files: `server.ts` (settings GET for `smtpConfig`, helmet config, rate limiters, error handlers), `.env_example`, `src/components/Settings.tsx` (SMTP form).
- Steps: never return the SMTP password (return `hasPassword: true`, keep old value when blank on save), or encrypt at rest with a key from `.env`; enable a CSP (allow `data:` images/fonts, test PDF export and html2canvas); lower the global limiter (comment says 200, value 5000); stop returning `error.message` to clients; document `SESSION_SECRET`, `ALLOW_SELF_UPDATE`; make `.env_example` PORT match compose (3000).

### H-11 Inspection protection
- Decision for the owner: it provides no security (JS bundle is public). Recommended: remove the setting and the effect in `App.tsx` (`inspectionProtection`) and the toggle in `Settings.tsx`.

---

## B. Money and quote logic

### H-12 Shared money module and discount model (highest-value logic task)
- Goal: one implementation of totals used by the form, PDF, server, Excel exports, with integer-cent math.
- Files: new `src/lib/money.ts` (importable by `server.ts` too, no React), `src/components/QuoteForm.tsx` (totals around "subtotal", "discountedSubtotal", "tax", "grandTotal", the `[markup]` effect, the `[subtotal, discountRate, discountMode]` effect), `src/pdf/quote-document.tsx` (`lineNetPrice`, totals), `server.ts` (save + PDF mapping ~L1255-1445), `Tracking.tsx` Excel export.
- Steps: (1) write `round2`, `lineTotal(qty, unit)`, `computeTotals({items, discount:{type:'amount'|'percent', value}, vatRate})` using integer minor units, with unit tests (qty fractions, 0, large values, 100% discount, discount > subtotal). (2) Store discount as one source of truth (type + value) and derive the other for display; cap at subtotal. Keep writing the legacy columns (`discount`, `discount_rate`, `discount_type`) so old data still loads. (3) Remove the mount-time `[markup]` effect that overwrites rounded prices after `fetchQuote`. (4) Use the module everywhere; PDF should print stored totals AND rows must sum to them.
- Done when: the same quote shows identical numbers in form, PDF, Excel, and DB; tests pass.
- Risks: the largest regression surface; compare old vs new totals on a sample of existing quotes before shipping.

### H-13 Multi-currency
- Files: `quotes` (additive `currency TEXT DEFAULT 'SAR'`), `QuoteForm.tsx` (about 20 hardcoded "SAR"), `quote-document.tsx`, `QuoteDiffViewer.tsx`, `Dashboard.tsx`, `Tracking.tsx`, `server.ts` PDF mapping (`currency: "SAR"`).
- Steps: add the column; a `formatMoney(value, currency)` using `Intl.NumberFormat`; per-quote currency selector; dashboards group by currency (don't sum mixed currencies).

### H-14 Validation and profit display
- Files: `QuoteForm.tsx`.
- Steps: clamp/validate qty > 0, unit price >= 0, markup > -100, VAT 0-100, inline errors instead of `alert`; block save of priced lines without description (or keep them and don't drop silently); compute profit after discount; add margin % = profit / sale next to markup; clear naming of `manual_price` (cost basis vs override); remove keyword-based special cases (`materials`, `EXCL`, `ZM`) or move them to settings.

### H-15 Id-based row updates
- Files: `QuoteForm.tsx` (`addItem`, `removeItem`, `updateItem`, `handleProductAutoTranslate`, `handleTranslateAll`, drag/drop, `rowRefs`, `descriptionRefs`).
- Steps: give each item a stable `uid`; use functional `setItems(prev => ...)`; translations write by `uid`; `handleTranslateAll` should merge results into current state and be abortable; make move up/down and add/remove push to the undo history; don't call `setItems` inside the `setItemsHistory` updater.

### H-16 Drafts and unsaved changes
- Files: `QuoteForm.tsx` (`DRAFT_KEY`, autosave effect, `isInitialLoadRef` 600 ms timer, recall path).
- Steps: key the draft by quote id (or tab id) and use the `storage` event; try/catch around `setItem` (QuotaExceeded); autosave for recalled quotes; `beforeunload` warning when dirty; replace the 600 ms timer with an explicit "loaded" flag.

### H-17 Status constants and dashboard revenue definition
- Files: new `src/lib/status.ts`, `KanbanBoard.tsx`, `Tracking.tsx`, `Dashboard.tsx`, server schemas (`BulkStatusSchema`).
- Steps: one `STATUSES` list + badge map + allowed transitions used everywhere. Ask the owner whether "Won revenue" should include Invoiced and how to treat revisions (`revision_of`) and converted tax invoices so revenue is not double counted; normalise dates server-side (Excel-serial dates appear in imported data: `Tracking.tsx` handles them, Dashboard doesn't).

### H-18 Tracking list behaviour
- Files: `Tracking.tsx`.
- Steps: clear selection when filters change; reset page to 1 on search/filter change; guard `rowsPerPage` (min 1, max e.g. 500); `useMemo` for filter/sort and debounce search; lowercase `muFilters` before `includes`; qty fallback `|| 1` in the Excel item totals; fetch settings once and share; stop silent failure of settings for non-admins; show loading/error/empty states; do PDF downloads with progress and `res.ok` handling.

### H-19 Atomic quote ID
- Files: `server.ts` (`next-id` ~L978-1018, `POST /api/quotes`).
- Steps: counter row in `settings` (or new `counters` table) incremented inside the same transaction that inserts the quote; keep the existing `ID_TAKEN` check as backup; read the prefix from settings.

### H-20 Soft delete and recycle bin
- Goal: deleting moves a quote to a recycle bin; restore/purge from `RecycleBin.tsx`.
- Files: `server.ts` (`DELETE /api/quotes/:id` currently hard deletes and wipes `activity_log`), `src/components/RecycleBin.tsx` (not imported anywhere), `src/App.tsx` route + nav.
- Steps: additive columns `deleted_at`, `deleted_by`, `retain_forever` (see `memory.md`, they are documented there as existing but check the migrations); filter deleted quotes out of every list/stat query; API: list/restore/purge; daily prune honouring `recycleBinDays`; permission `canManageRecycleBin`; audit log entries.

### H-21 PDF fixes and diff viewer
- Files: `src/pdf/quote-document.tsx`, `server.ts` PDF mapping, `src/components/QuoteDiffViewer.tsx`.
- Steps: bundle the Arabic/Latin TTFs into the repo (currently from jsDelivr, line ~4-10) and register by local path; footer phone/email from settings (line ~789); `fmtDate` without `toISOString` (use local date parts); unique React keys for `termsRows`; `ensureVisibleColor` support 3-digit hex and bail on invalid; zebra striping that ignores section rows; diff viewer: match items by id/code then description, compare unit, qty, price, discount, VAT, notes, terms; `Intl.NumberFormat`; dialog semantics.

### H-22 Profile modal reload
- `src/App.tsx` ProfileModal calls a full reload after save. Replace with an update of `user` state through the `auth-change` event (the listener already re-reads `localStorage`).

---

## C. UI / UX

### H-23 Accessibility pass
- Add `aria-label` to every icon-only button (grep `<button` with only an icon child), `role="dialog" aria-modal`, Escape to close, focus trap and focus return for all modals (Profile, ChangePassword, Follow-up, Note, Timeline drawer, QuoteDiffViewer), `aria-sort` and keyboard handling on sortable headers, labels on checkboxes, replace `alert`/`confirm` with a small toast + confirm-dialog component (`src/components/ui/`), raise contrast of 9-10 px grey text, respect `prefers-reduced-motion`.

### H-24 Mobile and states
- Quote row controls use `-right-9` (clip off-screen): move into the row; Tracking bulk bar: wrap and add bottom padding; nav hamburger below `md`; skeleton/loading/empty/error states for Tracking, Customer/Product/Supplier DBs, RecycleBin; keep AI panel from overlapping the bulk bar.

### H-25 Dark mode rebuild
- `src/index.css` lines ~308-600 override with `.dark .p-6.border-b...` selectors. Add `@custom-variant dark (&:where(.dark, .dark *));` (Tailwind v4), set the class before first paint with an inline script in `index.html` (default to `prefers-color-scheme`), migrate components to `dark:` utilities one screen at a time, then delete the overrides. Fix gaps: `bg-slate-50` (AIAssistant), `text-indigo-900` (Dashboard), `bg-teal-100`.

### H-26 i18n / RTL
- UI strings are hardcoded English. Introduce a tiny dictionary + `useT()`, set `<html lang dir>` from the user's language, use logical Tailwind classes (`ps-`, `pe-`), consistent date/number locale helpers.

### H-27 Split the giant components
- `QuoteForm.tsx` (4,900 lines): extract `useQuoteDraft`, `useQuoteTotals` (uses H-12), `api` client, `TermsEditor` (terms EN/AR pairs currently copied in state, draft, restore, save, PDF params, template load, translation: replace with one `terms` object), `ItemsTable` with `React.memo` rows, `PricingSidebar`, `useTranslate`. Three PDF/export paths exist (html2canvas x2, server React-PDF): decide on one.
- `Settings.tsx` (3,400 lines, 73 `useState`): tabs as separate components + `useSetting(key)` hook.
- Do these *after* H-12 and with tests.

---

## D. Ops

### H-28 Docker
- Add a non-root `USER` (check volume ownership first: existing bind-mounted `quotes.db`/`uploads` may be root-owned), `HEALTHCHECK` hitting a new `/api/health` route, mount a `./data` directory instead of the single `quotes.db` file (Docker creates a directory if the file is missing) with a documented migration, persist `backups/` and `error.log`, drop `version:` from compose, multi-stage prune of devDependencies (but `tsx` is a dev-style runtime dep: keep it).

### H-29 Performance and data access
- Indexes (additive): `quotes(author_id)`, `quotes(customer_id)`, `quote_items(quote_id)`, `activity_log(quote_id)`, `sessions(user_id)`. Server-side `?q=&page=&limit=` for customers/products/suppliers/quotes; bulk delete endpoint in one transaction (`CustomerDB.tsx`, `ProductDB.tsx` currently loop one DELETE per row; `SupplierDB.tsx` copy/move too); `price-sync` fuzzy match: index products by normalised name instead of `find` in a loop; avoid N+1 in `/quotes/:id/versions` and group lookups in `/api/quotes`.

### H-30 Tests, CI, dependencies
- Vitest for `money.ts`, status helpers, ID generation; supertest-style API tests (permission matrix); GitHub Actions: `tsc`, build, tests, `npm audit`. Remove unused deps (`puppeteer`, `@google/generative-ai` or `@google/genai`, `@types/express-rate-limit`), rename package from `react-example`, add `@types/react` / `@types/react-dom` and fix the resulting type errors in a dedicated PR.

---

## F. Feature suggestions (not started)
Each is independent; do after A and H-12.
1. **Client approval portal**: public tokenised link to view the PDF, Accept/Reject with typed or drawn signature; stores IP/time in `activity_log`; sets status. New table `quote_shares(token, quote_id, expires_at)`.
2. **Per-line discount and tax, optional items, section/subtotal rows in the UI**: PDF already supports `section` lines and a per-line `discount` field.
3. **Status workflow**: allowed transitions, "lost reason" on Rejected, follow-up reminders and expiry alerts on the dashboard.
4. **Drag-and-drop Kanban** (dnd-kit) with column totals and filters; move back to earlier stages.
5. **Dashboard**: date range, currency selector, profitability (margin) charts, Accepted vs Invoiced split, aging of open quotes.
6. **Audit log viewer** (logins, permission changes, exports, restores).
7. **2FA, password reset by email, active sessions list with revoke.**
8. **CSV import** for customers/products with dry-run preview and duplicate detection (by mobile/name).
9. **Backups**: off-site (S3-compatible) encrypted copy, verified restore test, backup before every restore/import.
10. **Recurring invoices, payment tracking** (partial payments, `amountPaid`/`amountDue` fields already exist in the PDF), email templates.
11. **Observability**: `/api/health`, structured logging with request IDs, error reporting.
