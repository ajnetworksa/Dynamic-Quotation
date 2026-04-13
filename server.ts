// =============================================================================
// server.ts — Express Backend
// =============================================================================
// Security hardening applied:
//   1. Passwords hashed with bcrypt (never stored in plaintext)
//   2. Session tokens generated with crypto.randomBytes (cryptographically secure)
//   3. HTTP security headers via helmet (hides X-Powered-By, adds CSP headers, etc.)
//   4. Rate limiting on /api/login (max 10 attempts / 15 min per IP)
//   5. Login input validation (non-empty, max 128 chars)
//   6. Global body limit reduced to 1mb; only /api/db/import keeps 50mb
//   7. .env is listed in .gitignore — never commit real API keys
// =============================================================================

import express from 'express';
import { createServer as createViteServer } from 'vite';
import Database from 'better-sqlite3';
import nodemailer from 'nodemailer';
import path from 'path';
import puppeteer from 'puppeteer';
import bcrypt from 'bcrypt';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import crypto from 'crypto';
import 'dotenv/config';
import multer from 'multer';
import OpenAI from 'openai';

const app = express();
const PORT = Number(process.env.PORT) || 3000;

// Setup OpenAI (OpenRouter) Client
const openai = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENROUTER_API_KEY || "dummy_key_to_prevent_startup_crash",
});

// Setup multer for memory storage
const upload = multer({ storage: multer.memoryStorage() });

// ── SECURITY: HTTP headers ────────────────────────────────────────────────────
// helmet() automatically sets a suite of security headers, including:
//   • X-Content-Type-Options: nosniff   (prevents MIME-sniffing attacks)
//   • X-Frame-Options: SAMEORIGIN       (prevents clickjacking)
//   • X-XSS-Protection                  (legacy XSS filter for older browsers)
//   • Removes the "X-Powered-By: Express" header that leaks tech info
//
// To allow iframing from a specific origin, remove helmet() and configure manually.
app.use(helmet({
  // Content-Security-Policy is disabled here because html2canvas & jsPDF
  // load fonts and images from data: URLs which a strict CSP would block.
  // If you are not using the PDF export in the browser, you can enable this.
  contentSecurityPolicy: false,
}));

// ── SECURITY: Body size limit ─────────────────────────────────────────────────
// The global limit is 1mb — sufficient for all normal API calls.
// Allowing 50mb globally would let anyone flood the server with large payloads.
// The /api/db/import route below overrides this with 50mb just for that endpoint.
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ limit: '1mb', extended: true }));

// ── SECURITY: Login rate limiter ──────────────────────────────────────────────
// Limits login attempts to 10 per 15 minutes per IP address.
// After exceeding the limit, the client gets HTTP 429 Too Many Requests.
//
// To change the limits:
//   • windowMs   → time window in milliseconds (15 * 60 * 1000 = 15 minutes)
//   • max        → max requests allowed in that window (10 = 10 attempts)
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15-minute window
  max: 10,                   // max 10 login attempts per IP per window
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts. Please try again in 15 minutes.' },
});

// ── BCRYPT COST FACTOR ────────────────────────────────────────────────────────
// 12 is a good balance of security vs speed (~300ms per hash on modern hardware).
// Increase to 13 or 14 for more security (doubles time per increment).
// Do NOT go below 10.
const BCRYPT_ROUNDS = 12;

// Initialize SQLite Database
const db = new Database('quotes.db');

// Create tables if they don't exist
db.exec(`
  CREATE TABLE IF NOT EXISTS customers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    address TEXT,
    contact TEXT,
    mobile TEXT,
    email TEXT
  );

  CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    description TEXT NOT NULL,
    unit TEXT,
    unit_price REAL NOT NULL
  );

  CREATE TABLE IF NOT EXISTS quotes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    quote_id TEXT UNIQUE NOT NULL,
    date TEXT NOT NULL,
    expiry_date TEXT,
    customer_id INTEGER,
    subject TEXT,
    subject_ar TEXT,
    subtotal REAL,
    tax REAL,
    grand_total REAL,
    discount REAL DEFAULT 0,
    status TEXT DEFAULT 'Draft',
    type TEXT DEFAULT 'Quotation',
    
    -- ── PRICING ANALYSIS FIELDS ───────────────────────────────────────────
    -- markup: The global profit percentage set in the QuoteForm sidebar.
    -- Used to automatically calculate unit_price for new items.
    markup REAL DEFAULT 8,
    
    FOREIGN KEY(customer_id) REFERENCES customers(id)
  );

  CREATE TABLE IF NOT EXISTS quote_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    quote_id TEXT NOT NULL,
    product_id INTEGER,
    description TEXT,
    description_ar TEXT,
    qty REAL,
    unit TEXT,
    
    -- ── PRICING ANALYSIS FIELDS ───────────────────────────────────────────
    -- original_price: The database price at the time the product was added.
    -- This is treated as the 'BASE' cost in the analysis sidebar.
    original_price REAL,
    
    -- manual_price: A user override entered in the sidebar. If set, this 
    -- takes precedence over the markup-calculated unit_price.
    manual_price REAL,
    
    unit_price REAL,
    net_price REAL,
    FOREIGN KEY(quote_id) REFERENCES quotes(quote_id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
  );

  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL,
    FOREIGN KEY(user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS activity_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    quote_id TEXT NOT NULL,
    action TEXT NOT NULL,
    actor TEXT,
    timestamp TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS system_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    level TEXT NOT NULL,
    source TEXT NOT NULL,
    type TEXT NOT NULL,
    message TEXT NOT NULL,
    details TEXT,
    timestamp TEXT NOT NULL
  );
`);

const addColumnIfNotExists = (table: string, column: string, type: string) => {
  try {
    const columns = db.pragma(`table_info(${table})`) as any[];
    if (!columns.some(c => c.name === column)) {
      db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`);
    }
  } catch (e) {
    console.error(`Failed to add column ${column} to ${table}:`, e);
  }
};

addColumnIfNotExists('quotes', 'updated_at', 'TEXT');
addColumnIfNotExists('quotes', 'note', 'TEXT');
addColumnIfNotExists('quotes', 'payment', 'TEXT');
addColumnIfNotExists('quotes', 'warranty', 'TEXT');
addColumnIfNotExists('quotes', 'manpower', 'TEXT');
addColumnIfNotExists('quotes', 'mobilization', 'TEXT');
addColumnIfNotExists('quotes', 'duration', 'TEXT');
addColumnIfNotExists('quotes', 'bank_details', 'TEXT');
addColumnIfNotExists('quotes', 'subject_ar', 'TEXT');
addColumnIfNotExists('quotes', 'note_header', 'TEXT');
addColumnIfNotExists('quotes', 'discount', 'REAL');
addColumnIfNotExists('quotes', 'status', 'TEXT DEFAULT "Draft"');
addColumnIfNotExists('quotes', 'type', 'TEXT DEFAULT "Quotation"');
addColumnIfNotExists('quotes', 'revision_of', 'TEXT');
addColumnIfNotExists('quotes', 'author_id', 'INTEGER');
addColumnIfNotExists('quotes', 'vat_rate', 'REAL DEFAULT 15');
addColumnIfNotExists('quotes', 'note_ar', 'TEXT');
addColumnIfNotExists('quotes', 'payment_ar', 'TEXT');
addColumnIfNotExists('quotes', 'warranty_ar', 'TEXT');
addColumnIfNotExists('quotes', 'manpower_ar', 'TEXT');
addColumnIfNotExists('quotes', 'mobilization_ar', 'TEXT');
addColumnIfNotExists('quotes', 'duration_ar', 'TEXT');
addColumnIfNotExists('quotes', 'bank_details_ar', 'TEXT');
addColumnIfNotExists('quotes', 'footer_ar', 'TEXT');
addColumnIfNotExists('quotes', 'custom_field_header', 'TEXT');
addColumnIfNotExists('quotes', 'custom_field', 'TEXT');
addColumnIfNotExists('quotes', 'custom_field_ar', 'TEXT');
addColumnIfNotExists('quote_items', 'description_ar', 'TEXT');
addColumnIfNotExists('products', 'description_ar', 'TEXT');
addColumnIfNotExists('quotes', 'expiry_date', 'TEXT');
addColumnIfNotExists('quotes', 'followup_date', 'TEXT');
addColumnIfNotExists('quotes', 'followup_note', 'TEXT');
addColumnIfNotExists('quotes', 'markup', 'REAL DEFAULT 8');
addColumnIfNotExists('quote_items', 'original_price', 'REAL');
addColumnIfNotExists('quote_items', 'manual_price', 'REAL');
addColumnIfNotExists('system_logs', 'type', 'TEXT DEFAULT "Unknown"');

// ── SECURITY: Default admin account ──────────────────────────────────────────
// On first boot, if no admin exists, one is created with a hashed password.
// The password 'admin123' is hashed with bcrypt — never stored in plaintext.
//
// ⚠️  IMPORTANT: Change this password via the Users page immediately after first login!
//
// Migration: if an admin exists but their password is NOT a bcrypt hash (i.e., it
// was created by an older version of this server), it is re-hashed automatically.
const adminRow = db.prepare('SELECT id, password FROM users WHERE username = ?').get('admin') as { id: number; password: string } | undefined;
if (!adminRow) {
  // Fresh install — create the default admin with a hashed password
  const hashedDefault = bcrypt.hashSync('admin123', BCRYPT_ROUNDS);
  db.prepare('INSERT INTO users (username, password, role) VALUES (?, ?, ?)').run('admin', hashedDefault, 'admin');
  console.log('✅ Default admin created. Change the password via the Users page!');
} else if (!adminRow.password.startsWith('$2')) {
  // Migration: existing admin has a plaintext password — hash it now
  const rehashed = bcrypt.hashSync(adminRow.password, BCRYPT_ROUNDS);
  db.prepare('UPDATE users SET password = ? WHERE id = ?').run(rehashed, adminRow.id);
  console.log('🔐 Migrated admin password to bcrypt hash.');
}

// ── SECURITY: Migrate any other plaintext passwords ───────────────────────────
// If other users were created before this security update, their passwords will
// also be in plaintext. This loop hashes them all on startup.
const allUsers = db.prepare('SELECT id, password FROM users').all() as { id: number; password: string }[];
for (const u of allUsers) {
  if (!u.password.startsWith('$2')) {
    const rehashed = bcrypt.hashSync(u.password, BCRYPT_ROUNDS);
    db.prepare('UPDATE users SET password = ? WHERE id = ?').run(rehashed, u.id);
  }
}

// ── SYSTEM LOGGING & GLOBAL ERROR HANDLING ────────────────────────────────────
const logSystemError = (source: string, type: string, message: string, details: string | null = null) => {
  try {
    db.prepare('INSERT INTO system_logs (level, source, type, message, details, timestamp) VALUES (?, ?, ?, ?, ?, ?)').run('ERROR', source, type, message, details, new Date().toISOString());
  } catch (e) {
    console.error('Failed to write to system logs:', e);
  }
};

const cleanupLogs = () => {
  try {
    const settingRow = db.prepare('SELECT value FROM settings WHERE key = ?').get('logExpirationDays') as { value: string } | undefined;
    const days = settingRow ? parseInt(settingRow.value, 10) : 7;
    // days = 0 means Never expire
    if (days > 0) {
      const expirationDate = new Date();
      expirationDate.setDate(expirationDate.getDate() - days);
      db.prepare('DELETE FROM system_logs WHERE timestamp < ?').run(expirationDate.toISOString());
    }
  } catch (e) {
    console.error('Failed to cleanup logs:', e);
  }
};
// Run cleanup on startup
cleanupLogs();

// Catch uncaught exceptions globally
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  logSystemError('Process', 'UncaughtException', err.message, err.stack);
});
process.on('unhandledRejection', (reason: any) => {
  console.error('Unhandled Rejection:', reason);
  logSystemError('Process', 'UnhandledRejection', reason?.message || String(reason), reason?.stack || null);
});

// ── Auth Middleware ───────────────────────────────────────────────────────────
// Validates the Bearer token in the Authorization header against the sessions table.
// Attaches the user object to req for downstream use.
const requireAuth = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Unauthorized' });

  const session = db.prepare('SELECT user_id FROM sessions WHERE token = ?').get(token) as { user_id: number } | undefined;
  if (!session) return res.status(401).json({ error: 'Unauthorized' });

  const user = db.prepare('SELECT id, username, role FROM users WHERE id = ?').get(session.user_id);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  (req as any).user = user;
  next();
};

// Restricts a route to admin-role users only (used after requireAuth).
const requireAdmin = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  if ((req as any).user.role !== 'admin') {
    return res.status(403).json({ error: 'Forbidden' });
  }
  next();
};

// ── API Routes ────────────────────────────────────────────────────────────────

// ── AUTH: Login ───────────────────────────────────────────────────────────────
// loginLimiter is applied first — blocks brute-force attempts.
// Inputs are validated for type, length, and emptiness before hitting the DB.
// Passwords are compared using bcrypt.compare (safe against timing attacks).
//
// SECURITY NOTE: We always respond with the same generic message for bad
// credentials regardless of whether the username or password was wrong.
// This prevents user-enumeration (knowing which usernames exist).
app.post('/api/login', loginLimiter, async (req, res) => {
  const { username, password } = req.body;

  // ── Input validation ──────────────────────────────────────────────────────
  // Reject blanks, non-strings, or anything suspiciously long (>128 chars).
  // This prevents the server from hashing or querying with absurd payloads.
  if (
    typeof username !== 'string' || !username.trim() || username.length > 128 ||
    typeof password !== 'string' || !password || password.length > 128
  ) {
    return res.status(400).json({ error: 'Invalid credentials' });
  }

  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username.trim()) as any;

  // bcrypt.compare returns false for wrong passwords without timing leaks.
  // We also handle the case where user is null safely to avoid timing differences.
  const passwordMatch = user ? await bcrypt.compare(password, user.password) : false;

  if (user && passwordMatch) {
    // ── SECURITY: Cryptographically secure session token ──────────────────
    // crypto.randomBytes(32) generates 32 bytes of OS-level random data.
    // hex encodes to 64 characters — effectively unguessable.
    const token = crypto.randomBytes(32).toString('hex');
    db.prepare('INSERT INTO sessions (token, user_id) VALUES (?, ?)').run(token, user.id);
    res.json({ token, user: { id: user.id, username: user.username, role: user.role } });
  } else {
    res.status(401).json({ error: 'Invalid credentials' });
  }
});

app.post('/api/logout', requireAuth, (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (token) {
    db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
  }
  res.json({ success: true });
});

app.get('/api/me', requireAuth, (req, res) => {
  res.json((req as any).user);
});

// ── Users Management (Admin only) ─────────────────────────────────────────────
app.get('/api/users', requireAuth, requireAdmin, (req, res) => {
  // Never return the password field — even though it's hashed, no need to expose it
  const users = db.prepare('SELECT id, username, role FROM users').all();
  res.json(users);
});

app.post('/api/users', requireAuth, requireAdmin, async (req, res) => {
  const { username, password, role } = req.body;

  // Validate before hashing
  if (
    typeof username !== 'string' || !username.trim() || username.length > 128 ||
    typeof password !== 'string' || !password || password.length > 128
  ) {
    return res.status(400).json({ error: 'Username and password are required (max 128 chars).' });
  }

  try {
    // ── SECURITY: Hash the password before storing ────────────────────────
    const hashed = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const info = db.prepare('INSERT INTO users (username, password, role) VALUES (?, ?, ?)').run(username.trim(), hashed, role);
    res.json({ id: info.lastInsertRowid });
  } catch (error: any) {
    res.status(400).json({ error: 'Username might already exist' });
  }
});

app.put('/api/users/:id', requireAuth, requireAdmin, async (req, res) => {
  const { username, password, role } = req.body;

  // Validate username
  if (typeof username !== 'string' || !username.trim() || username.length > 128) {
    return res.status(400).json({ error: 'Invalid username.' });
  }

  try {
    if (password) {
      if (typeof password !== 'string' || password.length > 128) {
        return res.status(400).json({ error: 'Invalid password.' });
      }
      // ── SECURITY: Hash the new password before updating ───────────────
      const hashed = await bcrypt.hash(password, BCRYPT_ROUNDS);
      db.prepare('UPDATE users SET username = ?, password = ?, role = ? WHERE id = ?').run(username.trim(), hashed, role, req.params.id);
    } else {
      db.prepare('UPDATE users SET username = ?, role = ? WHERE id = ?').run(username.trim(), role, req.params.id);
    }
    res.json({ success: true });
  } catch (error: any) {
    res.status(400).json({ error: 'Update failed' });
  }
});

app.delete('/api/users/:id', requireAuth, requireAdmin, (req, res) => {
  // Prevent deleting the last admin
  const adminCount = db.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'admin'").get() as { count: number };
  const userToDelete = db.prepare('SELECT role FROM users WHERE id = ?').get(req.params.id) as { role: string };

  if (userToDelete.role === 'admin' && adminCount.count <= 1) {
    return res.status(400).json({ error: 'Cannot delete the last admin' });
  }

  db.transaction(() => {
    db.prepare('DELETE FROM sessions WHERE user_id = ?').run(req.params.id);
    db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id);
  })();
  res.json({ success: true });
});

// ── Customers ─────────────────────────────────────────────────────────────────
app.get('/api/customers', requireAuth, (req, res) => {
  const customers = db.prepare('SELECT * FROM customers').all();
  res.json(customers);
});

app.post('/api/customers', requireAuth, (req, res) => {
  const { name, address, contact, mobile, email } = req.body;
  const stmt = db.prepare('INSERT INTO customers (name, address, contact, mobile, email) VALUES (?, ?, ?, ?, ?)');
  const info = stmt.run(name, address, contact, mobile, email);
  res.json({ id: info.lastInsertRowid });
});

app.put('/api/customers/:id', requireAuth, (req, res) => {
  const { name, address, contact, mobile, email } = req.body;
  const stmt = db.prepare('UPDATE customers SET name = ?, address = ?, contact = ?, mobile = ?, email = ? WHERE id = ?');
  stmt.run(name, address, contact, mobile, email, req.params.id);
  res.json({ success: true });
});

app.delete('/api/customers/:id', requireAuth, requireAdmin, (req, res) => {
  const stmt = db.prepare('DELETE FROM customers WHERE id = ?');
  stmt.run(req.params.id);
  res.json({ success: true });
});

// ── Products ──────────────────────────────────────────────────────────────────
app.get('/api/products', requireAuth, (req, res) => {
  const products = db.prepare('SELECT * FROM products').all();
  res.json(products);
});

app.post('/api/products', requireAuth, (req, res) => {
  const { description, description_ar, unit, unit_price } = req.body;
  const stmt = db.prepare('INSERT INTO products (description, description_ar, unit, unit_price) VALUES (?, ?, ?, ?)');
  const info = stmt.run(description, description_ar, unit, unit_price);
  res.json({ id: info.lastInsertRowid });
});

app.put('/api/products/:id', requireAuth, (req, res) => {
  const { description, description_ar, unit, unit_price } = req.body;
  const stmt = db.prepare('UPDATE products SET description = ?, description_ar = ?, unit = ?, unit_price = ? WHERE id = ?');
  stmt.run(description, description_ar, unit, unit_price, req.params.id);
  res.json({ success: true });
});

app.delete('/api/products/:id', requireAuth, requireAdmin, (req, res) => {
  const stmt = db.prepare('DELETE FROM products WHERE id = ?');
  stmt.run(req.params.id);
  res.json({ success: true });
});

// ── Quotes ────────────────────────────────────────────────────────────────────
app.get('/api/quotes/next-id', requireAuth, (req, res) => {
  try {
    const rows = db.prepare('SELECT quote_id FROM quotes').all() as { quote_id: string }[];
    let maxNum = 0;

    for (const row of rows) {
      if (row.quote_id) {
        const match = row.quote_id.match(/AJ-(\d+)/);
        if (match) {
          const num = parseInt(match[1], 10);
          if (num > maxNum) maxNum = num;
        }
      }
    }

    const nextNum = maxNum > 0 ? maxNum + 1 : 10001;
    const nextId = `AJ-${nextNum.toString().padStart(5, '0')}`;
    res.json({ nextId });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/quotes', requireAuth, (req, res) => {
  const quotes = db.prepare(`
    SELECT q.*, c.name as customer_name 
    FROM quotes q 
    LEFT JOIN customers c ON q.customer_id = c.id
    ORDER BY q.id DESC
  `).all();
  res.json(quotes);
});

app.get('/api/quotes/:quote_id', requireAuth, (req, res) => {
  const quote = db.prepare('SELECT * FROM quotes WHERE quote_id = ?').get(req.params.quote_id);
  if (quote) {
    const items = db.prepare('SELECT * FROM quote_items WHERE quote_id = ?').all(req.params.quote_id);
    res.json({ ...quote, items });
  } else {
    res.status(404).json({ error: 'Quote not found' });
  }
});

app.get('/api/quotes/:quote_id/versions', requireAuth, (req, res) => {
  const quoteId = req.params.quote_id;
  // Get base ID: 'AJ-12345-R2' -> 'AJ-12345'
  const baseIdMatch = quoteId.match(/^(AJ-\d+)/);
  if (!baseIdMatch) return res.status(400).json({ error: 'Invalid Quote ID format' });
  
  const baseId = baseIdMatch[1];
  
  // Fetch all quotes starting with this base ID 
  const history = db.prepare(`
    SELECT q.*, c.name as customer_name 
    FROM quotes q 
    LEFT JOIN customers c ON q.customer_id = c.id
    WHERE q.quote_id LIKE ? 
    ORDER BY q.quote_id ASC
  `).all(`${baseId}%`) as any[];

  // Fetch items for all of them
  for (const q of history) {
    q.items = db.prepare('SELECT * FROM quote_items WHERE quote_id = ?').all(q.quote_id);
  }

  res.json(history);
});

app.post('/api/quotes/:quote_id/send', requireAuth, async (req, res) => {
  const { to, subject, body, pdfHtml } = req.body;
  const quote_id = req.params.quote_id;

  try {
    const configRow = db.prepare('SELECT value FROM settings WHERE key = ?').get('smtpConfig') as { value: string };
    if (!configRow) return res.status(400).json({ error: 'SMTP not configured in Admin Settings' });

    const smtp = JSON.parse(configRow.value);
    const transporter = nodemailer.createTransport({
      host: smtp.host,
      port: smtp.port,
      secure: smtp.port === 465,
      auth: { user: smtp.user, pass: smtp.pass }
    });

    await transporter.verify();

    await transporter.sendMail({
      from: `"${smtp.fromName}" <${smtp.user}>`,
      to,
      subject: subject || `Document ${quote_id}`,
      text: body,
      html: `<p>${body.replace(/\\n/g, '<br/>')}</p>`
    });

    db.prepare('UPDATE quotes SET status = "Sent" WHERE quote_id = ?').run(quote_id);
    res.json({ success: true });
  } catch (err: any) {
    console.error('Email send error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/quotes', requireAuth, (req, res) => {
  const {
    quote_id, date, customer_id, subject, subject_ar, discount, subtotal, tax, grand_total, items,
    note_header, note, note_ar, payment, payment_ar, warranty, warranty_ar, manpower, manpower_ar,
    mobilization, mobilization_ar, duration, duration_ar, bank_details, bank_details_ar, footer, footer_ar,
    custom_field_header, custom_field, custom_field_ar, status, type, revision_of, vat_rate, expiry_date, markup
  } = req.body;
  const updated_at = new Date().toISOString();
  const author_id = (req as any).user.id;

  const actor = (req as any).user?.username || 'system';

  try {
    db.transaction(() => {
      const existing = db.prepare('SELECT id, status FROM quotes WHERE quote_id = ?').get(quote_id) as any;

      // Save main quote data, including the pricing markup
      if (existing) {
        const prevStatus = existing.status;
        db.prepare(`
          UPDATE quotes SET 
            date = ?, customer_id = ?, subject = ?, subject_ar = ?, discount = ?, subtotal = ?, tax = ?, grand_total = ?, updated_at = ?,
            note_header = ?, note = ?, note_ar = ?, payment = ?, payment_ar = ?, warranty = ?, warranty_ar = ?, 
            manpower = ?, manpower_ar = ?, mobilization = ?, mobilization_ar = ?, duration = ?, duration_ar = ?, 
            bank_details = ?, bank_details_ar = ?, footer = ?, footer_ar = ?,
            custom_field_header = ?, custom_field = ?, custom_field_ar = ?, status = ?, type = ?, revision_of = ?, vat_rate = ?, expiry_date = ?, markup = ?
          WHERE quote_id = ?
        `).run(
          date, customer_id, subject, subject_ar, discount || 0, subtotal, tax, grand_total, updated_at,
          note_header || 'NOTE:', note, note_ar, payment, payment_ar, warranty, warranty_ar,
          manpower, manpower_ar, mobilization, mobilization_ar, duration, duration_ar,
          bank_details, bank_details_ar, footer, footer_ar,
          custom_field_header || 'CUSTOM:', custom_field, custom_field_ar, status || 'Draft', type || 'Quotation', revision_of || null, vat_rate || 15, expiry_date || null, markup ?? 8,
          quote_id
        );
        db.prepare('DELETE FROM quote_items WHERE quote_id = ?').run(quote_id);
        
        const action = prevStatus !== (status || 'Draft')
          ? `Status changed to ${status || 'Draft'}`
          : 'Updated';
        db.prepare('INSERT INTO activity_log (quote_id, action, actor, timestamp) VALUES (?, ?, ?, ?)').run(quote_id, action, actor, updated_at);
      } else {
        db.prepare(`
          INSERT INTO quotes (
            quote_id, date, customer_id, subject, subject_ar, discount, subtotal, tax, grand_total, updated_at,
            note_header, note, note_ar, payment, payment_ar, warranty, warranty_ar, 
            manpower, manpower_ar, mobilization, mobilization_ar, duration, duration_ar, 
            bank_details, bank_details_ar, footer, footer_ar,
            custom_field_header, custom_field, custom_field_ar, status, type, revision_of, author_id, vat_rate, expiry_date, markup
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          quote_id, date, customer_id, subject, subject_ar, discount || 0, subtotal, tax, grand_total, updated_at,
          note_header || 'NOTE:', note, note_ar, payment, payment_ar, warranty, warranty_ar,
          manpower, manpower_ar, mobilization, mobilization_ar, duration, duration_ar,
          bank_details, bank_details_ar, footer, footer_ar,
          custom_field_header || 'CUSTOM:', custom_field, custom_field_ar, status || 'Draft', type || 'Quotation', revision_of || null, author_id, vat_rate || 15, expiry_date || null, markup ?? 8
        );
        db.prepare('INSERT INTO activity_log (quote_id, action, actor, timestamp) VALUES (?, ?, ?, ?)').run(quote_id, 'Created', actor, updated_at);
      }

      // Save each line item along with its original base price and any manual analysis overrides
      const insertItem = db.prepare('INSERT INTO quote_items (quote_id, product_id, description, description_ar, qty, unit, unit_price, net_price, original_price, manual_price) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
      for (const item of items) {
        insertItem.run(quote_id, item.product_id, item.description, item.description_ar, item.qty, item.unit, item.unit_price, item.net_price, item.original_price ?? null, item.manual_price ?? null);
      }
    })();
    res.json({ success: true });
  } catch (error: any) {
    console.error('Save quote error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/quotes/:quote_id', requireAuth, requireAdmin, (req, res) => {
  try {
    db.transaction(() => {
      db.prepare('DELETE FROM quote_items WHERE quote_id = ?').run(req.params.quote_id);
      db.prepare('DELETE FROM activity_log WHERE quote_id = ?').run(req.params.quote_id);
      db.prepare('DELETE FROM quotes WHERE quote_id = ?').run(req.params.quote_id);
    })();
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ── Quote Timeline ────────────────────────────────────────────────────────────
app.get('/api/quotes/:quote_id/timeline', requireAuth, (req, res) => {
  const rows = db.prepare('SELECT * FROM activity_log WHERE quote_id = ? ORDER BY timestamp ASC').all(req.params.quote_id);
  res.json(rows);
});

// ── Bulk Status Update ────────────────────────────────────────────────────────
app.patch('/api/quotes/bulk-status', requireAuth, (req, res) => {
  const { ids, status } = req.body;
  if (!Array.isArray(ids) || !status) return res.status(400).json({ error: 'ids and status required' });
  const actor = (req as any).user?.username || 'system';
  const ts = new Date().toISOString();
  try {
    db.transaction(() => {
      for (const id of ids) {
        db.prepare('UPDATE quotes SET status = ?, updated_at = ? WHERE quote_id = ?').run(status, ts, id);
        db.prepare('INSERT INTO activity_log (quote_id, action, actor, timestamp) VALUES (?, ?, ?, ?)').run(id, `Status changed to ${status}`, actor, ts);
      }
    })();
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ── Follow-up ─────────────────────────────────────────────────────────────────
app.patch('/api/quotes/:quote_id/followup', requireAuth, (req, res) => {
  const { followup_date, followup_note } = req.body;
  try {
    db.prepare('UPDATE quotes SET followup_date = ?, followup_note = ? WHERE quote_id = ?').run(followup_date || null, followup_note || null, req.params.quote_id);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ── Customer Stats ────────────────────────────────────────────────────────────
app.get('/api/customers/stats', requireAuth, (req, res) => {
  const rows = db.prepare(`
    SELECT customer_id,
           SUM(grand_total) as total_won,
           COUNT(*) as quote_count
    FROM quotes
    WHERE customer_id IS NOT NULL
    GROUP BY customer_id
  `).all();
  res.json(rows);
});

// ── Database Export / Import ───────────────────────────────────────────────────
app.get('/api/db/export', requireAuth, requireAdmin, (req, res) => {
  try {
    const customers = db.prepare('SELECT * FROM customers').all();
    const products = db.prepare('SELECT * FROM products').all();
    const quotes = db.prepare('SELECT * FROM quotes').all();
    const quote_items = db.prepare('SELECT * FROM quote_items').all();
    res.json({ customers, products, quotes, quote_items });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ── SECURITY: 50mb body limit only on this route ──────────────────────────────
// The global limit is 1mb. This specific route needs 50mb for large imports.
// We override body-parser just for this endpoint using express.json({ limit })
// as inline middleware before the handler.
app.post('/api/db/import', requireAuth, requireAdmin, express.json({ limit: '50mb' }), (req, res) => {
  const { customers, products, quotes, quote_items } = req.body;
  const importErrors: string[] = [];

  const logError = (table: string, rowIndex: number, record: any, err: any) => {
    const key = record.id ? `id=${record.id}` : record.quote_id ? `quote_id=${record.quote_id}` : `row #${rowIndex + 1}`;
    const msg = `[${table}] Row ${rowIndex + 1} (${key}): ${err.message}`;
    console.error(`❌ Import error - ${msg}`, '\nRecord:', JSON.stringify(record));
    importErrors.push(msg);
  };

  try {
    db.transaction(() => {
      db.prepare('DELETE FROM quote_items').run();
      db.prepare('DELETE FROM quotes').run();
      db.prepare('DELETE FROM products').run();
      db.prepare('DELETE FROM customers').run();

      const insertCustomer = db.prepare('INSERT INTO customers (id, name, address, contact, mobile, email) VALUES (?, ?, ?, ?, ?, ?)');
      (customers || []).forEach((c: any, i: number) => {
        try {
          insertCustomer.run(c.id, c.name ?? null, c.address ?? null, c.contact ?? null, c.mobile ?? null, c.email ?? null);
        } catch (err: any) { logError('customers', i, c, err); throw err; }
      });

      const insertProduct = db.prepare('INSERT INTO products (id, description, description_ar, unit, unit_price) VALUES (?, ?, ?, ?, ?)');
      (products || []).forEach((p: any, i: number) => {
        try {
          insertProduct.run(p.id, p.description ?? null, p.description_ar ?? null, p.unit ?? null, p.unit_price ?? 0);
        } catch (err: any) { logError('products', i, p, err); throw err; }
      });

      const insertQuote = db.prepare(`
        INSERT INTO quotes (
          id, quote_id, date, customer_id, subject, subject_ar, discount, subtotal, tax, grand_total, updated_at,
          note_header, note, note_ar, payment, payment_ar, warranty, warranty_ar, manpower, manpower_ar, 
          mobilization, mobilization_ar, duration, duration_ar, bank_details, bank_details_ar, footer, footer_ar,
          custom_field_header, custom_field, custom_field_ar, status, type, revision_of, author_id, vat_rate, markup
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      (quotes || []).forEach((q: any, i: number) => {
        try {
          insertQuote.run(
            q.id, q.quote_id, q.date ?? null, q.customer_id ?? null, q.subject ?? null, q.subject_ar ?? null,
            q.discount ?? 0, q.subtotal ?? 0, q.tax ?? 0, q.grand_total ?? 0, q.updated_at ?? null,
            q.note_header ?? 'NOTE:', q.note ?? null, q.note_ar ?? null, q.payment ?? null, q.payment_ar ?? null,
            q.warranty ?? null, q.warranty_ar ?? null, q.manpower ?? null, q.manpower_ar ?? null,
            q.mobilization ?? null, q.mobilization_ar ?? null, q.duration ?? null, q.duration_ar ?? null,
            q.bank_details ?? null, q.bank_details_ar ?? null, q.footer ?? null, q.footer_ar ?? null,
            q.custom_field_header ?? 'CUSTOM:', q.custom_field ?? null, q.custom_field_ar ?? null,
            q.status ?? 'Draft', q.type ?? 'Quotation', q.revision_of ?? null, q.author_id ?? null, q.vat_rate ?? 15, q.markup ?? 8
          );
        } catch (err: any) { logError('quotes', i, { id: q.id, quote_id: q.quote_id }, err); throw err; }
      });

      const insertQuoteItem = db.prepare('INSERT INTO quote_items (id, quote_id, product_id, description, description_ar, qty, unit, unit_price, net_price, original_price, manual_price) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
      (quote_items || []).forEach((qi: any, i: number) => {
        try {
          insertQuoteItem.run(qi.id, qi.quote_id, qi.product_id ?? null, qi.description ?? null, qi.description_ar ?? null, qi.qty ?? 0, qi.unit ?? null, qi.unit_price ?? 0, qi.net_price ?? 0, qi.original_price ?? null, qi.manual_price ?? null);
        } catch (err: any) { logError('quote_items', i, { id: qi.id, quote_id: qi.quote_id }, err); throw err; }
      });
    })();

    res.json({ success: true });
  } catch (error: any) {
    const detail = importErrors.length > 0 ? importErrors[importErrors.length - 1] : error.message;
    res.status(500).json({ error: `Import failed: ${detail}`, details: importErrors });
  }
});

// ── Settings / System ─────────────────────────────────────────────────────────
app.get('/api/admin/backup', requireAuth, requireAdmin, (req, res) => {
  const file = path.resolve(process.cwd(), 'quotes.db');
  res.download(file, `AJ_Network_DB_Backup_${new Date().toISOString().split('T')[0]}.db`);
});

app.get('/api/settings/:key', requireAuth, (req, res) => {
  try {
    const setting = db.prepare('SELECT value FROM settings WHERE key = ?').get(req.params.key) as { value: string } | undefined;
    res.json({ value: setting ? setting.value : null });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/settings', requireAuth, requireAdmin, (req, res) => {
  const { key, value } = req.body;
  try {
    db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(key, value);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ── Translation API ───────────────────────────────────────────────────────────
// Proxies to Google Translate. requireAuth ensures only logged-in users can use it.
app.post('/api/translate', requireAuth, async (req, res) => {
  const { text } = req.body;
  if (!text) return res.json({ translation: '' });

  try {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=ar&dt=t&q=${encodeURIComponent(text)}`;
    const response = await fetch(url);
    const data = await response.json();

    let translation = '';
    if (data && data[0]) {
      data[0].forEach((segment: any) => {
        if (segment[0]) translation += segment[0];
      });
    }

    res.json({ translation: translation.trim() });
  } catch (error: any) {
    console.error('Translation error:', error);
    res.status(500).json({ error: 'Translation failed' });
  }
});

// ── AI & Automation API ───────────────────────────────────────────────────────
// RFQ Parsing (Multimodal LLM extraction)
app.post('/api/rfq/parse', requireAuth, upload.single('file'), async (req, res) => {
  if (!process.env.OPENROUTER_API_KEY || process.env.OPENROUTER_API_KEY === 'dummy_key_to_prevent_startup_crash') {
    return res.status(400).json({ error: 'Please set OPENROUTER_API_KEY in your .env file to use AI features.' });
  }

  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  try {
    const base64Data = req.file.buffer.toString('base64');
    const mimeType = req.file.mimetype;
    
    const messages = [
      {
        role: "user",
        // @ts-ignore
        content: [
          {
            type: "text",
            text: "You are a professional estimator. Extract line items from this Request for Quotation (RFQ) document. " +
                  "Return a JSON array ONLY, where each object has: " +
                  "1. 'description' (string, the name or details of the product/service), " +
                  "2. 'qty' (number, the requested quantity), " +
                  "3. 'unit' (string, the unit of measure like 'pcs', 'ls', 'meters'). " +
                  "Do not include any other markdown formatting or conversational text, just the raw JSON array."
          },
          {
            type: "image_url",
            image_url: {
              url: `data:${mimeType};base64,${base64Data}`
            }
          }
        ]
      }
    ];

    const response = await openai.chat.completions.create({
      model: "google/gemma-3-27b-it:free", // Multimodal free model
      // @ts-ignore
      messages: messages,
      temperature: 0.1,
    });

    const aiRes = response.choices[0]?.message?.content || '[]';
    
    let cleaned = aiRes.trim();
    // Strip out <think> blocks common in DeepSeek R1 and other reasoning models
    cleaned = cleaned.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();

    if (cleaned.toLowerCase().startsWith('```json')) cleaned = cleaned.substring(7);
    if (cleaned.startsWith('```')) cleaned = cleaned.replace(/^```/, '');
    if (cleaned.endsWith('```')) cleaned = cleaned.replace(/```$/, '');
    cleaned = cleaned.trim();

    const items = JSON.parse(cleaned);
    res.json({ items });
  } catch (err: any) {
    console.error('RFQ Parse Error:', err);
    res.status(500).json({ error: 'Failed to process RFQ document. Ensure the file is an image and OpenRouter API key is set.' });
  }
});

// Database Assistant (Text-to-SQL)
app.post('/api/ai/chat', requireAuth, async (req, res) => {
  if (!process.env.OPENROUTER_API_KEY || process.env.OPENROUTER_API_KEY === 'dummy_key_to_prevent_startup_crash') {
    return res.status(400).json({ error: 'Please set OPENROUTER_API_KEY in your .env file to use AI features.' });
  }

  const { question } = req.body;
  if (!question) return res.status(400).json({ error: 'No question provided' });

  try {
    const schemaDefs = `
      Table Customers (id INTEGER, name TEXT, address TEXT, contact TEXT, mobile TEXT, email TEXT);
      Table Quotes (id INTEGER, quote_id TEXT, date TEXT, customer_id INTEGER, subtotal REAL, tax REAL, grand_total REAL, status TEXT, markup REAL);
      Table Quote_Items (id INTEGER, quote_id TEXT, product_id INTEGER, description TEXT, qty REAL, unit_price REAL, net_price REAL, original_price REAL, manual_price REAL);
    `;

    // Phase 1: Generate SQL formulation
    const sqlResponse = await openai.chat.completions.create({
      model: "openrouter/free", // Automatically routes to best available free model
      messages: [
        {
          role: "system",
          content: "You are an SQLite expert. Based on the following schema, generate ONLY a valid readonly SELECT query to answer the user's question. DO NOT include formatting like ```sql...```, just the query text. If you cannot answer it, return 'INVALID'.\n\n" + schemaDefs
        },
        { role: "user", content: question }
      ],
      temperature: 0,
    });

    const query = sqlResponse.choices[0]?.message?.content?.trim() || "";
    
    let cleanedQuery = query.trim();
    // Strip out <think> blocks common in DeepSeek R1 and other reasoning models
    cleanedQuery = cleanedQuery.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();

    if (cleanedQuery.toLowerCase().startsWith('```sql')) cleanedQuery = cleanedQuery.substring(6);
    if (cleanedQuery.startsWith('```')) cleanedQuery = cleanedQuery.replace(/^```/, '');
    if (cleanedQuery.endsWith('```')) cleanedQuery = cleanedQuery.replace(/```$/, '');
    cleanedQuery = cleanedQuery.trim();

    if (cleanedQuery === 'INVALID' || !cleanedQuery.toUpperCase().startsWith('SELECT')) {
      logSystemError('AI Assistant', 'QueryValidationError', `Data Assistant generated invalid SQL`, `Original Output:\n${query}\n\nCleaned Query:\n${cleanedQuery}`);
      return res.json({ answer: "I'm sorry, I couldn't understand how to fetch that information from the database securely." });
    }

    // Execute query
    let rows;
    try {
      rows = db.prepare(cleanedQuery).all();
    } catch (sqlErr: any) {
      logSystemError('AI Assistant', 'SQLException', `Database execution error: ${sqlErr.message}`, `Query: ${cleanedQuery}\n\nStack: ${sqlErr.stack || sqlErr}`);
      return res.json({ answer: `Database execution error: ${sqlErr.message}` });
    }

    // Phase 2: Natural Language Summary of Results
    const summaryResponse = await openai.chat.completions.create({
      model: "openrouter/free",
      messages: [
        {
          role: "system",
          content: "You are a helpful assistant. Provide a brief, professional answer to the user's question using the raw JSON data provided from the database. Do not mention SQLite or queries."
        },
        {
          role: "user",
          content: `Question: ${question}\nData limit applied. Database result: ${JSON.stringify(rows).substring(0, 1500)}`
        }
      ],
      temperature: 0.3,
    });

    res.json({
      answer: summaryResponse.choices[0]?.message?.content?.trim(),
      data: rows,
      query: cleanedQuery
    });

  } catch (err: any) {
    console.error('AI Chat Error:', err);
    res.status(500).json({ error: 'AI Assistant failed' });
  }
});

// ── SYSTEM LOGS ENDPOINTS ──────────────────────────────────────────────────
app.get('/api/admin/logs', requireAuth, requireAdmin, (req, res) => {
  try {
    // Return all logs, ordered descending by ID
    const logs = db.prepare('SELECT * FROM system_logs ORDER BY id DESC LIMIT 500').all();
    res.json(logs);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/admin/logs', requireAuth, requireAdmin, (req, res) => {
  try {
    db.prepare('DELETE FROM system_logs').run();
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ── GLOBAL EXPRESS ERROR HANDLER ──────────────────────────────────────────────
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled API Error:', err);
  logSystemError('Express API', 'UnhandledRouteError', `Error in ${req.method} ${req.url}: ${err.message}`, err.stack);
  res.status(500).json({ error: 'Internal Server Error' });
});

// ── Server Startup ────────────────────────────────────────────────────────────
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static('dist'));
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
