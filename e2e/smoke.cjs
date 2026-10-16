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
