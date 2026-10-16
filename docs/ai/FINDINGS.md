# Audit findings: Dynamic-Quotation

Source: static read of the code by three audits (quote form + PDF, app shell + dashboards, server + admin screens), 2026-10-16. Line numbers are from the commit this branch started from and will have shifted.

Status: **Done** = fixed on branch `ai-audit-fixes` (see `CHANGELOG-AI.md`). **Partial** = part fixed. **Open** = not touched, see `HANDOFF.md` (task ID in brackets).

## 1. Security and data exposure

| # | Sev | Finding | Where | Status |
|---|-----|---------|-------|--------|
| S1 | Critical | `quotes_old.db` committed: 176 customers with phones, 530 products, logo, 3 session tokens, admin password in plaintext (`admin123`). `.gitignore` rule ignored because already tracked. | repo root | **Partial**: untracked. History purge and credential rotation Open [H-01] |
| S2 | Critical | AI assistant runs model-written SQL; blocklist missed `sessions`, `system_logs`, `permission_groups`; non-admin check was a substring match bypassable with `OR`/comments; SQL errors echoed. | `server.ts` `/api/ai/chat` | **Partial**: blocklist extended, real predicate check, no OR/UNION/comments for non-admins, generic error. Full redesign Open [H-02] |
| S3 | Critical | Command injection: `git remote set-url origin ${url}` via `exec`. | `/api/system/remote-url` | **Done** (`execFile` + URL validation) |
| S4 | High | Self-update endpoint runs `git reset --hard`, `npm install`, build on the live server. | `/api/system/update` | **Done** (disabled unless `ALLOW_SELF_UPDATE=true`) |
| S5 | High | `GET /api/settings` unauthenticated (bank details, terms, images). | `server.ts` | **Done** (requires login). Per-key `/api/settings/:key` stays public for login-page branding [H-03] |
| S6 | High | `/api/translate` unauthenticated, can spend paid API key, no size cap. | `server.ts` | **Done** (auth + 20,000 char cap) |
| S7 | High | Status/bulk-status/follow-up routes had no ownership check; any user could change any quote. | `server.ts` | **Done** (uses `isQuoteVisibleToUser`; status value validated). Note: view-only shares can still change status [H-04] |
| S8 | High | Client trusted for `author_id`, `author_name`, totals, status on save. | `POST /api/quotes` | Open [H-04] |
| S9 | High | Product/customer/supplier mutations need only a login; `price-sync/apply` doesn't validate prices; last-admin demotion not guarded. | `server.ts` | Open [H-05] |
| S10 | High | Seeded `admin/admin123`; password minimum 4 chars. | `server.ts` | Open [H-06] |
| S11 | High | Session token in `localStorage` even without "Remember me"; stored unhashed in DB; password change doesn't revoke sessions; per-IP login limit only. | App, `server.ts` | **Partial**: token only sent to same-origin; drafts cleared on logout. Rest Open [H-07] |
| S12 | High | Restore: stale WAL/SHM, no integrity check, zip-slip risk, no snapshot. | `/api/admin/restore-zip` | **Done** for WAL/SHM, integrity + schema check, named-entry extraction. Snapshot-before-restore Open [H-08] |
| S13 | Medium | multer had no limits. | `server.ts` | **Done** (100 MB, 5 files). Per-route type checks Open [H-08] |
| S14 | Medium | `/quotes/:id/send` lets any owner mail any address; body not HTML-escaped. | `server.ts` | Open [H-09] |
| S15 | Medium | `/quotes/:id/versions` uses `LIKE 'AJ-123%'` (matches `AJ-1234`); `AJ` prefix hardcoded. | `server.ts` | Open [H-09] |
| S16 | Medium | SMTP password stored plaintext and returned to UI. | settings | Open [H-10] |
| S17 | Medium | Helmet CSP disabled; global rate limit 5000/15min; no per-user lockout; raw `error.message` returned. | `server.ts` | Open [H-10] |
| S18 | Medium | Right-click/F12 blocking gives no security and breaks paste/copy in inputs. | `App.tsx` | **Partial**: no longer blocks context menu in inputs. Removing it entirely is your call [H-11] |

## 2. Logic bugs

| # | Sev | Finding | Where | Status |
|---|-----|---------|-------|--------|
| L1 | High | Ctrl+S saved stale state and skipped validation; Ctrl+S/Ctrl+P also fired on every page (form is always mounted). | `QuoteForm.tsx` | **Done** |
| L2 | High | Kanban card opened a blank quote (`localStorage.currentQuoteId` + `/quote`, but form reads `?recall=`). | `KanbanBoard.tsx` | **Done** |
| L3 | High | Kanban crashed on null `grand_total`; Rejected/Cancelled/null-status quotes appeared nowhere; errors never shown; rollback flashed spinner. | `KanbanBoard.tsx` | **Done** |
| L4 | High | `/api/settings` returned 500 on current better-sqlite3 (double-quoted string literals). Broke Tracking's Excel settings fetch. | `server.ts` | **Done** (found while testing) |
| L5 | High | Fresh databases had no `quotes.footer` column, so saving any quote failed. | `server.ts` | **Done** (found while testing) |
| L6 | High | Email "send" status update used `"Sent"` double-quoted literal (would error). | `server.ts` | **Done** |
| L7 | High | Discount: amount not capped at subtotal; `both` mode rewrites rate and amount repeatedly; rounding drift. | `QuoteForm.tsx` | Open [H-12] |
| L8 | High | Rounding differs between form, PDF, Excel, server; mount-time markup effect overwrites rounded prices. | `QuoteForm.tsx`, PDF | Open [H-12] |
| L9 | Medium | VAT label hardcoded `VAT (15%)` in Excel exports though rate is editable. | `QuoteForm.tsx`, `Tracking.tsx` | **Done** |
| L10 | Medium | Currency hardcoded to SAR everywhere. | many | Open [H-13] |
| L11 | Medium | Qty/price/markup/VAT not range-validated; description-less lines dropped on save but counted in totals. | `QuoteForm.tsx` | Open [H-14] |
| L12 | Medium | Profit ignores discount; only markup shown, no margin %. | `QuoteForm.tsx` | Open [H-14] |
| L13 | Medium | Row edits/translations are index-based; stale closures; `handleTranslateAll` discards edits typed during translation. | `QuoteForm.tsx` | Open [H-15] |
| L14 | Medium | Draft: one global key across tabs; no autosave for recalled quotes; no `beforeunload`; `isInitialLoadRef` uses a 600 ms timer. | `QuoteForm.tsx` | Open [H-16] |
| L15 | Medium | Status vocabulary inconsistent: Tracking dropdown lacked Invoiced/Cancelled (Invoiced displayed as Draft). | `Tracking.tsx` | **Done** (options + badges added). Single shared constant Open [H-17] |
| L16 | Medium | Dashboard: 6-month loop overflowed on the 29th-31st; UTC month keys; win rate counted drafts; ring was static. | `Dashboard.tsx` | **Done**. Revenue definition (Invoiced? revisions double-counted?) Open [H-17] |
| L17 | Medium | Tracking mutations ignored `res.ok` (showed success on 403/400). | `Tracking.tsx` | **Done** |
| L18 | Medium | CSV export: unquoted commas, no BOM (Arabic garbled), formula injection. | `Tracking.tsx` | **Done** |
| L19 | Medium | Tracking: selection survives filter changes; page not reset on filter change; unmemoised filter/sort; `rowsPerPage` empty → `Infinity`. | `Tracking.tsx` | Open [H-18] |
| L20 | Medium | Unknown routes render a blank page. | `App.tsx` | **Done** (redirect home) |
| L21 | Medium | No ErrorBoundary: any render error blanks the app. | `main.tsx` | **Done** |
| L22 | Medium | `JSON.parse(localStorage...)` unguarded in 8+ places. | many | **Done** (`src/lib/storage.ts`) |
| L23 | Medium | Fetch interceptor attached token to every URL, replaced `Headers` instances. | `App.tsx` | **Done** |
| L24 | Medium | Logout left the quote draft for the next user of a shared browser. | `App.tsx` | **Done** (manual logout clears; session expiry keeps the draft) |
| L25 | Medium | Excel `item.qty` missing → NaN; `muFilters` case-sensitive; settings fetch silently differs by user. | `Tracking.tsx` | Open [H-18] |
| L26 | Medium | Quote ID allocation race (scan then insert). | `server.ts` | Open [H-19] |
| L27 | Medium | RecycleBin component is dead code; delete is a hard delete and wipes the activity log. | `RecycleBin.tsx`, `server.ts` | Open [H-20] |
| L28 | Medium | PDF: fonts from jsDelivr CDN; hardcoded footer phone/email; `toISOString` date shift; duplicate React keys; `ensureVisibleColor` breaks on 3-digit hex. | `quote-document.tsx` | Open [H-21] |
| L29 | Low | Diff viewer matches items by index, compares few fields, hardcoded currency, no dialog semantics. | `QuoteDiffViewer.tsx` | Open [H-21] |
| L30 | Low | ProfileModal reloads the page after saving (loses unsaved form). | `App.tsx` | Open [H-22] |
| L31 | Low | `/login` pathname check in interceptor refers to a nonexistent route. | `App.tsx` | Open (harmless) |

## 3. UI / UX / accessibility

| # | Finding | Status |
|---|---------|--------|
| U1 | Login: labels not tied to inputs, no autocomplete, error not announced, non-JSON error responses broke message, no show-password. | **Done** |
| U2 | Kanban: move buttons invisible on touch/keyboard; cards not keyboard accessible; no column totals; no empty state. | **Done** |
| U3 | Dashboard win-rate ring didn't reflect value; no accessible label. | **Done** |
| U4 | Icon-only buttons without `aria-label` elsewhere; modals lack dialog semantics, Escape, focus trap; `alert`/`confirm` used in ~37 flows. | Open [H-23] |
| U5 | Mobile: quote row controls at `-right-9` clip off-screen; Tracking bulk bar overflows; no hamburger nav. | Open [H-24] |
| U6 | Dark mode built on `!important` structural overrides; `dark:` utilities follow OS not toggle; light flash on load. | Open [H-25] |
| U7 | No loading/error/empty states on Tracking and DB screens. | Open [H-24] |
| U8 | Sortable table headers not keyboard operable; no `aria-sort`. | Open [H-23] |
| U9 | All strings English; app chrome has no RTL/`lang` switching. | Open [H-26] |

## 4. Maintainability and ops

| # | Finding | Status |
|---|---------|--------|
| M1 | `QuoteForm.tsx` 4,900 lines; `Settings.tsx` 3,400 lines with 73 `useState`. Same logic copied (terms EN/AR pairs, translation fetch x4, totals x2, three PDF paths). | Open [H-27] |
| M2 | Dockerfile: `src/pdf` not copied (container fails to start); `npm install` instead of `npm ci`. | **Done** |
| M3 | Dockerfile runs as root; no HEALTHCHECK; compose maps `./quotes.db` as a file (becomes a directory if missing); backups/logs not persisted; `version:` obsolete. | Open [H-28] |
| M4 | No DB indexes on `quotes.author_id`, `quote_items.quote_id`, `activity_log.quote_id`, `sessions.user_id`. | Open [H-29] |
| M5 | Lists (customers, products, suppliers, quotes) fetched in full; bulk delete is one request per row. | Open [H-29] |
| M6 | No tests, no CI. `@types/react` is not installed so `tsc` type-checks React as `any`. | Open [H-30] |
| M7 | Unused deps: `puppeteer` (large), two Gemini packages, `@types/express-rate-limit`; package named `react-example`. | Open [H-30] |
| M8 | `.vscode/` was tracked despite `.gitignore`. | **Done** (untracked) |

## 5. Suggested features
Listed with implementation notes in `HANDOFF.md` section F.
