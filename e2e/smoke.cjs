// End-to-end smoke test with Playwright (Chromium). Not part of CI: it needs a browser.
//   1. npm run build
//   2. start the server on a scratch folder:  ADMIN_INITIAL_PASSWORD='Admin-Pass-12345' PORT=3999 NODE_ENV=production npx tsx server.ts
//   3. node e2e/smoke.cjs        (set BASE_URL / ADMIN_PASSWORD / SHOT_DIR to override)
// Requires `playwright` (globally or `npm i -D playwright`) and a Chromium (PLAYWRIGHT_BROWSERS_PATH or `npx playwright install chromium`).
const { chromium } = require('playwright');

const BASE = process.env.BASE_URL || 'http://localhost:3999';
const PASS = process.env.ADMIN_PASSWORD || 'Admin-Pass-12345';
const SHOTS = process.env.SHOT_DIR || '/tmp';
const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  - ' + detail : ''}`); };

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox'] });
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error' && !/Content Security Policy|favicon|Failed to load resource|Failed to fetch/i.test(m.text())) errors.push('console: ' + m.text()); });

  // ── login ──
  await page.goto(BASE + '/');
  check('login form shown', await page.locator('#login-username').isVisible());
  await page.fill('#login-username', 'admin');
  await page.fill('#login-password', 'wrong-password-1');
  await page.click('button[type=submit]');
  await page.waitForSelector('[role=alert]');
  check('wrong password shows an error', (await page.locator('[role=alert]').first().innerText()).length > 0);
  await page.fill('#login-password', PASS);
  await page.click('button[type=submit]');
  await page.waitForSelector('nav[aria-label=Main]');
  check('login succeeds, nav visible', true);

  // ── every route renders without errors ──
  for (const route of ['/', '/quote', '/products', '/customers', '/suppliers', '/tracking', '/kanban', '/recycle-bin', '/users', '/settings']) {
    const before = errors.length;
    await page.goto(BASE + route);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(400);
    const body = (await page.locator('body').innerText()).length;
    check(`route ${route} renders`, body > 50 && errors.length === before, errors.slice(before).join(' | ').slice(0, 300));
  }
  await page.goto(BASE + '/definitely-not-a-page');
  await page.waitForLoadState('networkidle');
  check('unknown route redirects home', new URL(page.url()).pathname === '/');

  // ── Kanban ──
  await page.goto(BASE + '/kanban');
  await page.waitForSelector('h1');
  check('kanban has 6 columns', (await page.locator('h2').count()) >= 6);
  await page.screenshot({ path: `${SHOTS}/kanban.png` });

  // ── language toggle / RTL ──
  await page.goto(BASE + '/');
  await page.click('button[aria-label=Language]');
  check('Arabic toggle sets rtl', (await page.evaluate(() => document.documentElement.dir)) === 'rtl');
  await page.screenshot({ path: `${SHOTS}/dashboard-ar.png` });
  await page.click('button[aria-label="اللغة"]');
  check('English toggle restores ltr', (await page.evaluate(() => document.documentElement.dir)) === 'ltr');

  // ── dark mode ──
  await page.click('button[aria-label="Dark Mode"]');
  check('dark mode class applied', await page.evaluate(() => document.documentElement.classList.contains('dark')));
  await page.screenshot({ path: `${SHOTS}/dashboard-dark.png` });
  await page.click('button[aria-label="Light Mode"]');

  // ── quote form: totals, discount cap, currency ──
  await page.goto(BASE + '/quote');
  await page.waitForLoadState('networkidle');
  const desc = page.locator('textarea').first();
  await desc.fill('Test cable');
  const numberInputs = page.locator('input[type=number], input[inputmode=decimal]');
  await page.screenshot({ path: `${SHOTS}/quote.png`, fullPage: true });
  check('quote page has currency selector', await page.locator('#quote-currency').count() === 1);
  await page.selectOption('#quote-currency', 'USD');
  check('currency changes labels', (await page.locator('text=USD').count()) > 0);

  // ── confirm dialog replaces window.confirm ──
  await page.goto(BASE + '/tracking');
  await page.waitForLoadState('networkidle');
  check('tracking renders table headers with aria-sort', (await page.locator('th[aria-sort]').count()) >= 5);

  // ── full quote flow: totals, discount cap, record, Ctrl+S, delete -> recycle bin -> restore ──
  await page.evaluate(() => fetch('/api/customers', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'Acme E2E' }) }));
  await page.goto(BASE + '/quote');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(600);
  await page.fill('input[placeholder="Search or select customer..."]', 'Acme E2E');
  await page.fill('input[placeholder^="e.g., Supply"]', 'E2E subject');
  const row = '[data-row-index="0"]';
  await page.locator(`${row} textarea`).first().fill('Cable CAT6');
  await page.locator(`${row} input[type=number]`).first().fill('2');
  const price = page.locator(`${row} input.font-mono`).first();
  await price.fill('10.005');
  await price.blur();
  await page.waitForTimeout(300);
  const money = async (label) => {
    const t = await page.locator(`text=${label}`).first().locator('xpath=following-sibling::div[1]').innerText();
    return parseFloat(t.replace(/[^0-9.\-]/g, ''));
  };
  check('subtotal = 20.02 (2 x 10.01, price rounded as shown)', (await money('SUBTOTAL')) === 20.02, String(await money('SUBTOTAL')));
  const disc = page.locator('input[placeholder="0.00"]').first();
  await disc.fill('500');
  await page.waitForTimeout(200);
  check('discount is capped at the subtotal', Number(await disc.inputValue()) <= 20.02, await disc.inputValue());
  await disc.fill('5');
  await page.waitForTimeout(300);
  check('total = (20.02 - 5) x 1.15 = 17.27', (await money('TOTAL PACKAGE')) === 17.27, String(await money('TOTAL PACKAGE')));
  await page.click('button:has-text("Record")');
  await page.waitForSelector('[role=status]:has-text("recorded"), [role=status]:has-text("Quote data")', { timeout: 15000 });
  check('Record shows a toast (no blocking alert)', true);
  await page.screenshot({ path: `${SHOTS}/quote-recorded.png`, fullPage: true });
  // Ctrl+S saves current values
  await page.waitForTimeout(5000); // let the first toast fade so the next one is unambiguous
  await page.fill('input[placeholder^="e.g., Supply"]', 'E2E subject edited');
  await page.keyboard.press('Control+s');
  await page.waitForSelector('[role=status]:has-text("AJ-10001"), [role=status]:has-text("updated")', { timeout: 15000 });
  check('Ctrl+S saves the edited subject', true);
  const saved = await page.evaluate(async () => (await (await fetch('/api/quotes/AJ-10001')).json()).subject);
  check('server stored the edited subject', saved === 'E2E subject edited', saved);
  const storedTotals = await page.evaluate(async () => { const q = await (await fetch('/api/quotes/AJ-10001')).json(); return [q.subtotal, q.discount, q.tax, q.grand_total].join('/'); });
  check('server stored consistent totals', storedTotals === '20.02/5/2.25/17.27', storedTotals);

  await page.goto(BASE + '/tracking');
  await page.waitForSelector('tr:has-text("AJ-10001")');
  await page.locator('tr:has-text("AJ-10001") button[aria-label="Delete Record"]').click();
  check('confirm dialog appears (not window.confirm)', await page.locator('[role=alertdialog]').isVisible());
  await page.keyboard.press('Escape');
  check('Escape cancels the dialog', (await page.locator('[role=alertdialog]').count()) === 0);
  await page.locator('tr:has-text("AJ-10001") button[aria-label="Delete Record"]').click();
  await page.click('[role=alertdialog] button >> nth=-1'); // the confirm button is last
  await page.waitForSelector('tr:has-text("AJ-10001")', { state: 'detached' });
  check('delete moves the quote out of Tracking', true);
  await page.goto(BASE + '/recycle-bin');
  await page.waitForSelector('text=AJ-10001');
  check('quote is in the Recycle Bin', true);
  await page.screenshot({ path: `${SHOTS}/recycle-bin.png` });

  // ── restore from the recycle bin, then client approval link (public page, separate browser context) ──
  await page.goto(BASE + '/recycle-bin');
  await page.waitForSelector('text=AJ-10001');
  await page.evaluate(() => fetch('/api/recycle-bin/AJ-10001/restore', { method: 'POST' }));
  const link = await page.evaluate(async () => (await (await fetch('/api/quotes/AJ-10001/share-link', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ days: 7 }) })).json()).url);
  const anon = await browser.newContext({ viewport: { width: 420, height: 900 } });
  const ap = await anon.newPage();
  const apErrors = [];
  ap.on('pageerror', e => apErrors.push(e.message));
  await ap.goto(link);
  await ap.waitForSelector('h1');
  check('approval page shows the document without login', (await ap.locator('body').innerText()).includes('AJ-10001') && (await ap.locator('body').innerText()).includes('Cable CAT6'));
  const [asw, acw] = await ap.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.clientWidth]);
  check('approval page fits a phone screen', asw <= acw, `${asw}/${acw}`);
  check('approval page never shows costs or markup', !/markup|manual|original/i.test(await ap.locator('body').innerText()));
  await ap.screenshot({ path: `${SHOTS}/approval-phone.png`, fullPage: true });
  await ap.click('button:has-text("Accept")');
  await ap.fill('#ap-name', 'Sara Client');
  await ap.check('input[type=checkbox]');
  await ap.click('button:has-text("Confirm acceptance")');
  await ap.waitForSelector('text=has been accepted');
  check('client can accept online', true);
  await anon.close();
  const st = await page.evaluate(async () => (await (await fetch('/api/quotes/AJ-10001')).json()).status);
  check('quote status became Accepted', st === 'Accepted', st);
  await page.goto(BASE + '/tracking');
  await page.waitForSelector('tr:has-text("AJ-10001")');
  await page.locator('tr:has-text("AJ-10001")').first().locator('button[aria-label="View Timeline"]').first().click();
  await page.waitForSelector('text=Client approval link');
  check('history drawer has payments and approval-link panels', (await page.locator('text=Payments').count()) > 0);
  await page.screenshot({ path: `${SHOTS}/history-drawer.png` });
  await page.keyboard.press('Escape');

  // ── kanban drag & drop ──
  await page.evaluate(() => fetch('/api/quotes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ quote_id: 'AJ-10050', date: '2026-10-16', subject: 'dnd', items: [{ description: 'x', qty: 1, unit: 'pc', unit_price: 5, net_price: 5 }], status: 'Draft', type: 'Quotation', subtotal: 5, tax: 0.75, grand_total: 5.75, is_new: true }) }));
  await page.goto(BASE + '/kanban');
  await page.waitForSelector('[data-column="Draft"] >> text=AJ-10050');
  await page.locator('[data-column="Draft"] [role=button]:has-text("AJ-10050")').dragTo(page.locator('[data-column="Sent"]'));
  await page.waitForSelector('[data-column="Sent"] >> text=AJ-10050');
  check('kanban drag and drop moves a card to Sent', true);
  const dndStatus = await page.evaluate(async () => (await (await fetch('/api/quotes/AJ-10050')).json()).status);
  check('drag and drop saved on the server', dndStatus === 'Sent', dndStatus);
  await page.locator('[data-column="Sent"] [role=button]:has-text("AJ-10050")').dragTo(page.locator('[data-column="Rejected"]'));
  await page.waitForSelector('[role=dialog] textarea');
  await page.fill('[role=dialog] textarea', 'Too expensive');
  await page.keyboard.press('Enter');
  await page.waitForSelector('[data-column="Rejected"] >> text=AJ-10050');
  const reason = await page.evaluate(async () => (await (await fetch('/api/quotes/AJ-10050')).json()).lost_reason);
  check('rejecting asks for a reason and stores it', reason === 'Too expensive', String(reason));

  // ── CSV import UI ──
  await page.goto(BASE + '/customers');
  await page.waitForLoadState('networkidle');
  await page.click('button:has-text("Import CSV")');
  await page.setInputFiles('#csv-file', { name: 'c.csv', mimeType: 'text/csv', buffer: Buffer.from('Company,Phone,Email\nCSV One,0501110001,one@x.com\nCSV Two,0501110002,\nAcme E2E,0501110003,\n') });
  await page.waitForSelector('text=duplicates');
  const summary = await page.locator('[role=dialog]').innerText();
  check('CSV preview flags the existing customer as duplicate', /1\s*duplicates/.test(summary) && /2\s*new/.test(summary), summary.replace(/\s+/g, ' ').slice(0, 160));
  await page.click('button:has-text("Import 2 rows")');
  await page.waitForSelector('[role=status]:has-text("Import complete")');
  check('CSV import adds the new rows', (await page.locator('text=CSV One').count()) > 0);

  // ── Add-to-Product-DB dialog (extracted component) from a quote line ──
  await page.goto(BASE + '/quote');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(500);
  const row1 = '[data-row-index="1"]';
  await page.locator(`${row1} textarea`).first().click();
  await page.locator(`${row1} textarea`).first().fill('Brand new gadget XYZ');
  await page.click('text=to Product DB');
  await page.waitForSelector('[role=dialog][aria-label="Add to Product DB"]');
  await page.fill('#ap-price', '99.5');
  await page.fill('#ap-code', 'GAD-XYZ');
  await page.click('button:has-text("Save & Add to Quote")');
  await page.waitForSelector('[role=dialog][aria-label="Add to Product DB"]', { state: 'detached' });
  const prods = await page.evaluate(async () => (await (await fetch('/api/products')).json()).filter(p => p.item_code === 'GAD-XYZ').map(p => p.unit_price));
  check('Add-to-Product-DB creates the product', prods.length === 1 && prods[0] === 99.5, JSON.stringify(prods));
  const unit = await page.locator(`${row1} input.font-mono`).first().inputValue();
  check('the quote line is filled with the product price plus markup (99.50 x 1.08)', unit === '107.46', unit);

  // ── settings: generic choice cards save and persist ──
  await page.goto(BASE + '/settings');
  await page.waitForLoadState('networkidle');
  await page.locator('[role=radiogroup][aria-label="Discount Calculation Mode"] [role=radio]:has-text("Percentage (%)"):not(:has-text("Both"))').click();
  await page.waitForSelector('text=Saved');
  await page.reload();
  await page.waitForLoadState('networkidle');
  const pct = await page.locator('[role=radiogroup][aria-label="Discount Calculation Mode"] [role=radio]:has-text("Percentage (%)"):not(:has-text("Both"))').getAttribute('aria-checked');
  check('choice setting persists after reload', pct === 'true', String(pct));
  await page.locator('[role=radiogroup][aria-label="Discount Calculation Mode"] [role=radio]').first().click();
  await page.waitForSelector('text=Saved');

  // ── security modal + audit log page ──
  await page.goto(BASE + '/');
  await page.click('button[aria-label=Profile]');
  await page.click('text=Two-factor login and signed-in devices');
  await page.waitForSelector('text=Account security');
  await page.click('button:has-text("Set up")');
  await page.waitForSelector('img[alt^="QR code"]');
  check('2FA setup shows a QR code', true);
  await page.screenshot({ path: `${SHOTS}/security.png` });
  await page.keyboard.press('Escape');
  await page.goto(BASE + '/audit-log');
  await page.waitForSelector('td:has-text("LOGIN")');
  check('audit log lists logins', true);

  // ── phone width: no page-level horizontal scroll ──
  await page.setViewportSize({ width: 390, height: 800 });
  for (const route of ['/', '/kanban', '/tracking', '/quote']) {
    await page.goto(BASE + route);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);
    const [sw, cw] = await page.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.clientWidth]);
    check(`phone ${route}: no horizontal page scroll`, sw <= cw, `${sw}/${cw}`);
  }
  await page.screenshot({ path: `${SHOTS}/phone-quote.png` });

  check('no console/page errors during the run', errors.length === 0, errors.join(' | ').slice(0, 500));
  await browser.close();
  const failed = results.filter(r => !r.ok).length;
  console.log(`\n${results.length - failed}/${results.length} checks passed`);
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error('E2E crashed:', e); process.exit(2); });
