# Change log: AI audit fixes

Branch: `ai-audit-fixes`. Date: 2026-10-16. Two rounds of work: round 1 (security and the most visible bugs) and round 2 (everything else that could be done and verified).
Rules followed: smallest safe change per item, additive database changes only, no API shape removed, every change checked.

## How it was verified

| Check | Result |
|-------|--------|
| `npx tsc --noEmit` (with real `@types/react`) | clean |
| `npx vitest run` | 65 unit tests pass (money, discount/rounding, AI SQL guard, TOTP RFC 6238 vectors, CSV, import de-duplication, diff matching, status/revenue, dashboard stats, recurrence dates, backup crypto, i18n, dates) |
| `npm run build` | succeeds |
| `e2e/api-smoke.sh <scratch-dir>` | about 70 curl checks against a fresh database: auth, lockout, session hashing/revocation, permissions, totals, recycle bin, ID reservations, paging, bulk delete, PDF (offline fonts), e-mail validation, audit log, sessions, 2FA login, approval link (public view, PDF, accept, no cost leakage), payments (overpay blocked), rejection reasons, CSV imports, catalog permission, encrypted backup + restore, recurring schedule |
| `e2e/smoke.cjs` (Playwright + Chromium) | 53 checks in a real browser: login, every route renders with no console errors, deep links, Kanban (6 columns, drag and drop, rejection reason), quote flow (totals, discount cap, Record toast, Ctrl+S, server totals), confirm dialog, Recycle Bin, public approval page on a phone viewport, Add-to-Product-DB dialog, CSV import preview, 2FA setup QR, audit log, settings persistence, Arabic/RTL, dark mode, no horizontal page scroll at 390 px |
| Not verified | Docker image build (no daemon in the sandbox); real SMTP e-mail sending; the UI on real phones/Safari/Firefox; a very large database |

Screenshots from the browser run are written to `e2e/shots/` (git-ignored).

## Round 1 (commit 69d4aea)
Server hardening (command injection, open endpoints, ownership checks, restore validation, upload limits, AI SQL guard), three bugs that were already in the code (`quotes.footer` column, SQL literal quoting x2), Kanban/Dashboard/Tracking/Login/Ctrl+S fixes, ErrorBoundary, safe storage reads, Dockerfile `src/pdf`. Details in git history.

## Round 2

### Money and quote logic
- `src/lib/money.ts` (tested): `round2`, `lineTotal`, `computeTotals`, discount helpers, margin %, `formatMoney`. Used by the form, the server (totals recomputed on every save), the PDF and the diff viewer.
- Discount capped at the subtotal, one rounding rule everywhere, unit price stored as shown, markup effect rounds like every other path, profit after discount, margin %, qty/price/VAT/markup validation, priced lines without description refused.
- Per-quote currency (`quotes.currency`, default SAR): form, PDF, diff viewer, dashboard (never adds mixed currencies).
- Rows are updated by id and with functional updates; translations land on the right row; Ctrl+Z undoes add / remove / move / drag; unsaved-edit warning on recalled quotes; quota-safe draft cache; re-saving a quote you just recorded no longer shows "ID exists".
- PDF: Tajawal fonts bundled in `assets/fonts` (no CDN), footer phone/e-mail/name from settings (new "Company Details" card), local-time dates, 3-digit hex colours, unique keys.
- Diff viewer rewritten: lines matched by item code/description, more fields compared, quote currency, dialog semantics.

### Security and data
- Session tokens stored as SHA-256 (one-time migration), revoked on password change/reset, per-account lockout (8 failures / 15 min), 10+ character passwords, random first admin password, last-admin demotion guard.
- Safe AI assistant (read-only connection + filtered views). Edit rights for status/follow-up/payments. `canEditCatalog` permission with a one-time migration that keeps existing users' access.
- Content-Security-Policy enforced in production; database errors hidden from clients; request IDs and JSON logs; audit log (viewer page + automatic trail for state-changing calls, logins, exports, restores; 1-year retention).
- TOTP two-factor login (setup with QR, enable, disable, admin reset) and a "signed-in devices" list with revoke.
- Encrypted backups (AES-256-GCM + scrypt): download and restore; restore routine shared with ZIP restore, always takes a safety snapshot first.

### Data model additions (all additive)
`quotes`: `currency`, `lost_reason`, `deleted_at`, `deleted_by`, `retain_forever`, `footer`. `users`: `totp_secret`, `totp_enabled`. `sessions`: `created_at`, `user_agent`, `ip`. New tables: `id_reservations`, `audit_log`, `quote_payments`, `quote_shares`, `recurring_schedules`. Indexes on the hot lookups. Settings keys: `companyName`, `companyPhone`, `companyEmail`, `recycleBinDays`.

### Features
Client approval links, payments + balance on invoices, rejection reasons, Kanban drag and drop, dashboard period selector + follow-ups due + expiring offers + open-quote aging + top rejection reasons, Recycle Bin (restore / pin / purge), CSV import with duplicate detection (customers, products), recurring documents, audit log viewer, security screen (2FA + devices), company details settings, encrypted backups.

### UI
Toasts and confirm/prompt dialogs replace `alert`/`confirm` (everywhere), generic dialog accessibility (focus, Escape, Tab trap), aria-labels on icon buttons, keyboard-operable sortable headers and rows, skip link, `aria-current`, header and phone layout fixes (no page-level horizontal scroll), dark mode follows the toggle and the OS with no flash, reduced-motion support, visible focus, loading/error/empty states on all list screens, English/Arabic toggle with RTL for navigation, Kanban and Dashboard, deep links work in production (SPA fallback).

### Ops
Docker entrypoint (fixes volume ownership, drops to the `node` user, explains the "DB mount is a directory" mistake), HEALTHCHECK, `DB_PATH`, backups volume, `.env_example` cleaned (port, new variables), unused dependencies removed (`puppeteer`, two Gemini packages, `motion`), package renamed, GitHub Actions CI (type check, tests, build, audit), `/api/health`.

### Refactors (behaviour-preserving, covered by the browser test)
`QuoteForm.tsx`: Add-Product, Add-Customer, record-before-export, overwrite, version-conflict and save-template dialogs and the totals panel moved to `src/components/quote/`. `Settings.tsx`: three duplicated choice cards replaced by `settings/ChoiceSettingCard`. Restore logic shared in `swapInDatabase`.

## Round 3: Users & permissions, Settings layout, Recycle Bin regression
- **Recycle Bin auto-clear restored.** The Settings dropdown (7 / 14 / 30 / 60 / 90 days / Never) that the `feat/bulk-export` branch and the earlier build had was missing here. It is back as `settings/RecycleBinSettings.tsx` under Settings → Data & Backups, saving the same `recycleBinDays` key. The Recycle Bin page shows the current retention.
- **Prune bug fixed.** `pruneRecycleBin` read `0` ("Never") as 30 days. It now uses `src/lib/recycleBin.ts` (`parseRecycleBinDays`, `recycleBinCutoff`, 3 unit tests); 0 = never.
- **Settings** regrouped into sections with a sidebar (tab strip on phones): Company & Branding, Documents & PDF, Quote Behaviour, Email, Data & Backups, System, plus "Show everything". The section is in the URL (`/settings#email`). Cards were moved as whole blocks; no handler, state, settings key or API call changed (`settings/SettingsNav.tsx`).
- **Users & permissions** (`UsersDB.tsx`): user list with avatar, role badge, group membership, quote-visibility badge and an access meter (n/26); search and role filter. Add/Edit opens a dialog with numbered steps (account with password-length hint, role cards, group preset, quotation visibility, features). The 26 permissions are grouped into 6 categories with All/None per category, a search box and counters. Permission Groups use the same editor. Handlers and request payloads are unchanged.
- Verified: tsc, 68 unit tests, build, API smoke, browser test 68/68 (new: every Settings section renders, section hash, Recycle Bin "Never" persists and shows on the Recycle Bin page, user created through the grouped editor saves the expected permission JSON, edit dialog shows saved ticks, Escape closes it, no horizontal scroll on /users and /settings at 390 px).

## Merging `main` (owner's commits 018d801 and 34414b1)
- `main` had its own dark-mode and security fixes (Oct 4 commit `018d801`). Merged into this branch: one pre-paint theme script (saved choice, else the OS; also sets `colorScheme`); `src/lib/theme.ts` keeps the OS default until the user toggles.
- Restored two things from `018d801` that were dropped when that commit was first merged: the **dark/light toggle on the Login page** (with `dark:` classes) and the **language-code check on `/api/translate`**. Its other server changes (safe git remote URL, auth on settings/translate, share-aware visibility, configurable prefix in `/versions`) were already covered here.
- Verified: browser test 72/72 (login toggle, dark-OS first visit), API smoke (bad language code → 400).

## Behaviour changes you should know about
- **Dashboard** win rate is now won / (won + rejected); revenue counts Accepted **and** Invoiced, a quote and the invoice made from it once.
- **Ctrl+S / Ctrl+P / Ctrl+Z** only act on the quote page.
- **Unit price** is stored with two decimals (what you see is what is multiplied).
- **Deleting a quote** moves it to the Recycle Bin (30 days by default, `recycleBinDays` setting); it used to be permanent.
- **Passwords** must be 10+ characters. New installs get a random admin password printed once in the server log (or set `ADMIN_INITIAL_PASSWORD`).
- **New users** do not get `canEditCatalog`, `canManageRecycleBin`, `canViewAuditLog` until an admin ticks them. Existing users keep catalog access.
- **Settings and `/api/settings/*`** need a login.
- **Self-update** is off unless `ALLOW_SELF_UPDATE=true`.
- **CSP is enforced** in production. If you add third-party scripts or inline scripts, allow them in `server.ts` (search `scriptSrc`), or run with `CSP_REPORT_ONLY=true` while testing.
- **Docker**: the container now starts as root only long enough to fix ownership, then runs as `node`.

## Manual test checklist before merging
1. Log in/out; wrong password; 2FA setup from the profile menu, log out and back in with a code.
2. Quote: add lines, discount larger than subtotal, change currency, Record, edit, Ctrl+S, Export PDF and Excel, print.
3. Kanban: drag a card between columns, reject (reason prompt), open a card.
4. Tracking: change status, follow-up date, note, delete (goes to Recycle Bin), restore from Recycle Bin.
5. History drawer: add a payment, create an approval link, open it in a private window, accept it, check the quote became Accepted.
6. Customers/Products: import a CSV with a duplicate row.
7. Settings: company details, encrypted backup download and restore on a test copy.
8. Phone: open the Dashboard, Kanban, Tracking and a quote on a real phone.
9. `docker compose up -d --build`, then `docker compose ps` shows healthy; `docker logs` shows the first admin password on a new database.

## Running the tests
```
npm ci
npx vitest run                        # unit tests
npm run build                         # needed by the browser test
./e2e/api-smoke.sh /tmp/api-smoke     # starts its own server on :3999
# browser test (needs Playwright + Chromium):
ADMIN_INITIAL_PASSWORD='Admin-Pass-12345' LOGIN_RATE_LIMIT_MAX=1000 DB_PATH=/tmp/e2e/quotes.db PORT=3999 NODE_ENV=production npx tsx server.ts &
node e2e/smoke.cjs
```
