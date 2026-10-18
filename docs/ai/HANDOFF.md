# Handoff: what is left, for another AI (or developer)

Read `FINDINGS.md` (every issue and its status) and `CHANGELOG-AI.md` (what was done and how it was verified) first. Branch: `ai-audit-fixes`.

## Ground rules
- Stack: React 19 + TypeScript + Vite + Tailwind v4 (`src/`), Express + better-sqlite3 (`server.ts`, one large file), `@react-pdf/renderer` for PDFs (`src/pdf/quote-document.tsx`).
- Database changes must be additive (`addColumnIfNotExists` / `CREATE TABLE IF NOT EXISTS` in `server.ts`). Existing installs hold real data.
- Shared, tested logic lives in `src/lib/` (`money`, `status`, `dates`, `csv`, `importDedupe`, `aiQuery`, `totp`, `backupCrypto`, `recurrence`, `dashboardStats`, `quoteDiff`, `notify`, `i18n`). Prefer adding pure functions there with unit tests.
- Use `toast`, `confirmAsync`, `promptAsync` from `src/lib/notify.ts`, never `alert`/`confirm`.
- Every API call goes through a global `fetch` wrapper in `App.tsx` that adds the Bearer token.
- `QuoteForm` stays mounted (hidden) on every page: global listeners must check `window.location.pathname === '/quote'`.
- Check after each change: `npx tsc --noEmit`, `npx vitest run`, `npm run build`, `./e2e/api-smoke.sh <dir>`, and the browser test `e2e/smoke.cjs` (see `CHANGELOG-AI.md`). Restart the server between browser-test runs (login rate limit).
- Port 3999 is used by the test scripts. When killing test servers, do not use a pattern that also matches your own shell.

Task format: **Goal / Files / Steps / Done when / Risks.**

---

### H-01 Purge the leaked database from git history (needs the owner)
- Goal: `quotes_old.db` (176 customers with phones, 530 products, session tokens, plaintext `admin123`) is no longer reachable in history. It is untracked now but every old clone and fork still has it.
- Steps: tell the owner this rewrites history and everyone must re-clone; run `git filter-repo --path quotes_old.db --path .vscode --invert-paths` on a fresh mirror; force-push after approval. On any server that ever used that file: change the admin password and delete all rows in `sessions`. Treat the customer list as disclosed.
- Done when: `git log --all -- quotes_old.db` is empty on the remote.
- Risks: destructive and irreversible for forks; do not do it without explicit approval.

### H-07 Session storage
- Goal: stop keeping the session token in `localStorage`.
- State: tokens are hashed in the database, revoked on password change, locked out per account, listed per device, 2FA available, sent only to the same origin. The browser still stores the raw token in `localStorage` (every `localStorage.getItem('token')` call).
- Options: (a) httpOnly `SameSite=Strict` cookie + CSRF token header (server: `requireAuth` reads the cookie; client: remove explicit Authorization headers; add `credentials`), or (b) keep Bearer tokens but use `sessionStorage` when "Remember me" is off. (b) logs users out in every new tab, so prefer (a).
- Done when: a script injected into the page cannot read a long-lived credential. Update the e2e test and the public approval page (it must keep working without a session).

### H-16 Draft handling
- Draft cache key (`quote_draft`) is shared by all tabs and an explicit "loaded" flag replaces the 600 ms `isInitialLoadRef` timer in `QuoteForm`. Key the draft by tab id or quote id and listen for the `storage` event.

### H-26 Translate the rest of the UI
- `src/lib/i18n.ts` has an English/Arabic dictionary and `t()`; navigation, Kanban and Dashboard use it. Wrap the remaining screen strings in `t()` and add Arabic text. Replace left/right Tailwind classes (`ml-`, `pl-`, `left-`) with logical ones (`ms-`, `ps-`, `start-`) screen by screen, checking each in RTL with `e2e/smoke.cjs` screenshots.

### H-27 Split the big components
- `QuoteForm.tsx` is ~4,500 lines and `Settings.tsx` ~3,180. Extracted so far: dialogs and the totals panel (`src/components/quote/`), `ChoiceSettingCard`, `CompanyProfileSettings`, `EncryptedBackupPanel`.
- Next for QuoteForm: the terms editors (the `X`/`XAr` pairs repeated in state, draft, restore, save, PDF params, templates and translation should become one `terms` object), the items table with `React.memo` rows, `useQuoteDraft`, `useQuoteTotals`, an `api` client. Three export paths exist (two html2canvas, one server React-PDF): decide on one.
- Settings is now split into sections (`settings/SettingsNav.tsx`); the cards still live in `Settings.tsx`. Next for Settings: move each section into its own file, then the logo/footer/stamp image cards (same pattern x3), font sizes, SMTP, system logs, MU filters, users of `useSetting(key)`.
- Do each extraction as its own commit and run the browser test.

### H-29 Server-side lists in the UI
- `GET /api/customers` and `/api/products` accept `?page=&limit=&q=` and return `{ items, total, page, limit }`; the Customer/Product/Supplier screens still load full lists and paginate in the browser (fine for hundreds of rows). Switch them over (and add the same to `/api/quotes` and suppliers) when lists reach thousands.

### H-31 Per-line discount / tax, optional items, section rows
- Why it was not done: they change the printed layout and the cost sidebar alignment and need a design decision.
- Files: `quote_items` (additive columns e.g. `discount`, `item_type`, `optional`), `QuoteForm.tsx` rows (grid columns `[48px 1fr 64px 64px 110px 110px]` and the `ResizeObserver` row-height sync), `src/lib/money.ts` (`lineTotal(qty, unit, discountPct)`, `computeTotals` must skip optional lines), `src/pdf/quote-document.tsx` (already renders `type: 'section'` and a per-line `discount`), server save/load and PDF mapping, `Tracking.tsx` Excel export.
- Done when: totals agree between form, PDF, Excel and database (add unit tests first).

### H-32 Password reset by e-mail
- Needs an e-mail column on users (additive), a reset-token table (hashed, 1 hour), `POST /api/password-reset/request` and `/confirm` using the existing SMTP settings, rate limiting and an audit entry. Admin-initiated reset already exists (`PUT /api/users/:id` with a password revokes sessions).

### H-33 Automatic off-site backups
- Encrypted backups can be downloaded and restored (`/api/admin/backup-encrypted`, `/restore-encrypted`). Add a scheduled upload of the encrypted file to S3-compatible storage (credentials via `.env`, retention setting, "last successful off-site backup" status on the Settings page).

### H-34 Port the `feat/bulk-export` branch (needs a decision)
- `origin/feat/bulk-export` has features not on this branch: bulk download of separate Excel files and PDFs from Tracking, a merged Excel export, drag-and-drop styling in QuoteForm. It branched from an older codebase, so merging it would revert many fixes (security, money module, etc.).
- Steps: port the features by hand onto `ai-audit-fixes` (Tracking bulk actions, ExcelJS merged sheet using `src/lib/money.ts` and the quote currency/VAT), not by merge. Its Recycle Bin settings were already restored here.

### Smaller open items
- Per-route magic-byte checks for uploaded PDF/Excel/ZIP files (size limits exist).
- Enforce status transitions (e.g. Invoiced cannot go back to Draft) if the business wants it.
- Margin chart on the Dashboard; saved filter views in Tracking.
- Encrypt the SMTP password at rest (key from `.env`).
- Lower the global API rate limit after watching real traffic (default 5000 / 15 min, set `API_RATE_LIMIT_MAX`).
- Hosted error tracking (Sentry etc.).
