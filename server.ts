import express from 'express';
import { createServer as createViteServer } from 'vite';
import Database from 'better-sqlite3';
import nodemailer from 'nodemailer';
import path from 'path';
import puppeteer from 'puppeteer';

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

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
    customer_id INTEGER,
    subject TEXT,
    subtotal REAL,
    tax REAL,
    grand_total REAL,
    FOREIGN KEY(customer_id) REFERENCES customers(id)
  );

  CREATE TABLE IF NOT EXISTS quote_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    quote_id TEXT NOT NULL,
    product_id INTEGER,
    description TEXT,
    qty REAL,
    unit TEXT,
    unit_price REAL,
    net_price REAL,
    FOREIGN KEY(quote_id) REFERENCES quotes(quote_id)
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

// Arabic translation columns
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

// Create default admin if no users exist
const adminExists = db.prepare('SELECT id FROM users WHERE username = ?').get('admin');
if (!adminExists) {
  db.prepare('INSERT INTO users (username, password, role) VALUES (?, ?, ?)').run('admin', 'admin123', 'admin');
}

// Auth Middleware
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

const requireAdmin = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  if ((req as any).user.role !== 'admin') {
    return res.status(403).json({ error: 'Forbidden' });
  }
  next();
};

// API Routes

// Auth
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  const user = db.prepare('SELECT * FROM users WHERE username = ? AND password = ?').get(username, password) as any;

  if (user) {
    const token = Math.random().toString(36).substring(2) + Date.now().toString(36);
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

// Users Management (Admin only)
app.get('/api/users', requireAuth, requireAdmin, (req, res) => {
  const users = db.prepare('SELECT id, username, role FROM users').all();
  res.json(users);
});

app.post('/api/users', requireAuth, requireAdmin, (req, res) => {
  const { username, password, role } = req.body;
  try {
    const info = db.prepare('INSERT INTO users (username, password, role) VALUES (?, ?, ?)').run(username, password, role);
    res.json({ id: info.lastInsertRowid });
  } catch (error: any) {
    res.status(400).json({ error: 'Username might already exist' });
  }
});

app.put('/api/users/:id', requireAuth, requireAdmin, (req, res) => {
  const { username, password, role } = req.body;
  try {
    if (password) {
      db.prepare('UPDATE users SET username = ?, password = ?, role = ? WHERE id = ?').run(username, password, role, req.params.id);
    } else {
      db.prepare('UPDATE users SET username = ?, role = ? WHERE id = ?').run(username, role, req.params.id);
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

// Customers
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

// Products
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

// Quotes
app.get('/api/quotes/next-id', requireAuth, (req, res) => {
  try {
    const rows = db.prepare('SELECT quote_id FROM quotes').all() as { quote_id: string }[];
    let maxNum = 0;

    for (const row of rows) {
      if (row.quote_id) {
        // Only look at base ID without revision part, e.g., AJ-56993, ignore -R1
        const match = row.quote_id.match(/AJ-(\d+)/);
        if (match) {
          const num = parseInt(match[1], 10);
          if (num > maxNum) {
            maxNum = num;
          }
        }
      }
    }

    let nextNum = maxNum > 0 ? maxNum + 1 : 10001; // Start from 10001 if empty
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

    // Ideally we would generate the PDF blob here or attach what the client sends.
    // For simplicity, we assume the client is sending standard email details.
    await transporter.sendMail({
      from: `"${smtp.fromName}" <${smtp.user}>`,
      to,
      subject: subject || `Document ${quote_id}`,
      text: body,
      html: `<p>${body.replace(/\\n/g, '<br/>')}</p>`
    });

    // Update quote status to Sent
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
    custom_field_header, custom_field, custom_field_ar, status, type, revision_of, vat_rate
  } = req.body;
  const updated_at = new Date().toISOString();
  // We extract the user_id from the auth middleware to track who made the quote
  const author_id = (req as any).user.id;

  try {
    db.transaction(() => {
      const existing = db.prepare('SELECT id FROM quotes WHERE quote_id = ?').get(quote_id);

      if (existing) {
        db.prepare(`
          UPDATE quotes SET 
            date = ?, customer_id = ?, subject = ?, subject_ar = ?, discount = ?, subtotal = ?, tax = ?, grand_total = ?, updated_at = ?,
            note_header = ?, note = ?, note_ar = ?, payment = ?, payment_ar = ?, warranty = ?, warranty_ar = ?, 
            manpower = ?, manpower_ar = ?, mobilization = ?, mobilization_ar = ?, duration = ?, duration_ar = ?, 
            bank_details = ?, bank_details_ar = ?, footer = ?, footer_ar = ?,
            custom_field_header = ?, custom_field = ?, custom_field_ar = ?, status = ?, type = ?, revision_of = ?, vat_rate = ?
          WHERE quote_id = ?
        `).run(
          date, customer_id, subject, subject_ar, discount || 0, subtotal, tax, grand_total, updated_at,
          note_header || 'NOTE:', note, note_ar, payment, payment_ar, warranty, warranty_ar,
          manpower, manpower_ar, mobilization, mobilization_ar, duration, duration_ar,
          bank_details, bank_details_ar, footer, footer_ar,
          custom_field_header || 'CUSTOM:', custom_field, custom_field_ar, status || 'Draft', type || 'Quotation', revision_of || null, vat_rate || 15,
          quote_id
        );
        db.prepare('DELETE FROM quote_items WHERE quote_id = ?').run(quote_id);
      } else {
        db.prepare(`
          INSERT INTO quotes (
            quote_id, date, customer_id, subject, subject_ar, discount, subtotal, tax, grand_total, updated_at,
            note_header, note, note_ar, payment, payment_ar, warranty, warranty_ar, 
            manpower, manpower_ar, mobilization, mobilization_ar, duration, duration_ar, 
            bank_details, bank_details_ar, footer, footer_ar,
            custom_field_header, custom_field, custom_field_ar, status, type, revision_of, author_id, vat_rate
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          quote_id, date, customer_id, subject, subject_ar, discount || 0, subtotal, tax, grand_total, updated_at,
          note_header || 'NOTE:', note, note_ar, payment, payment_ar, warranty, warranty_ar,
          manpower, manpower_ar, mobilization, mobilization_ar, duration, duration_ar,
          bank_details, bank_details_ar, footer, footer_ar,
          custom_field_header || 'CUSTOM:', custom_field, custom_field_ar, status || 'Draft', type || 'Quotation', revision_of || null, author_id, vat_rate || 15
        );
      }

      const insertItem = db.prepare('INSERT INTO quote_items (quote_id, product_id, description, description_ar, qty, unit, unit_price, net_price) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');

      for (const item of items) {
        insertItem.run(quote_id, item.product_id, item.description, item.description_ar, item.qty, item.unit, item.unit_price, item.net_price);
      }
    })();

    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/quotes/:quote_id', requireAuth, requireAdmin, (req, res) => {
  try {
    const deleteItems = db.prepare('DELETE FROM quote_items WHERE quote_id = ?');
    const deleteQuote = db.prepare('DELETE FROM quotes WHERE quote_id = ?');

    db.transaction(() => {
      deleteItems.run(req.params.quote_id);
      deleteQuote.run(req.params.quote_id);
    })();

    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Database Export/Import
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

app.post('/api/db/import', requireAuth, requireAdmin, (req, res) => {
  const { customers, products, quotes, quote_items } = req.body;
  try {
    db.transaction(() => {
      db.prepare('DELETE FROM quote_items').run();
      db.prepare('DELETE FROM quotes').run();
      db.prepare('DELETE FROM products').run();
      db.prepare('DELETE FROM customers').run();

      const insertCustomer = db.prepare('INSERT INTO customers (id, name, address, contact, mobile, email) VALUES (?, ?, ?, ?, ?, ?)');
      for (const c of customers || []) insertCustomer.run(c.id, c.name ?? null, c.address ?? null, c.contact ?? null, c.mobile ?? null, c.email ?? null);

      const insertProduct = db.prepare('INSERT INTO products (id, description, description_ar, unit, unit_price) VALUES (?, ?, ?, ?, ?)');
      for (const p of products || []) insertProduct.run(p.id, p.description ?? null, p.description_ar ?? null, p.unit ?? null, p.unit_price ?? 0);

      const insertQuote = db.prepare(`
        INSERT INTO quotes (
          id, quote_id, date, customer_id, subject, subject_ar, discount, subtotal, tax, grand_total, updated_at,
          note_header, note, note_ar, payment, payment_ar, warranty, warranty_ar, manpower, manpower_ar, 
          mobilization, mobilization_ar, duration, duration_ar, bank_details, bank_details_ar, footer, footer_ar,
          custom_field_header, custom_field, custom_field_ar, status, type, revision_of, author_id, vat_rate
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      for (const q of quotes || []) {
        insertQuote.run(
          q.id, q.quote_id, q.date ?? null, q.customer_id ?? null, q.subject ?? null, q.subject_ar ?? null, q.discount ?? 0, q.subtotal ?? 0, q.tax ?? 0, q.grand_total ?? 0, q.updated_at ?? null,
          q.note_header ?? 'NOTE:', q.note ?? null, q.note_ar ?? null, q.payment ?? null, q.payment_ar ?? null, q.warranty ?? null, q.warranty_ar ?? null,
          q.manpower ?? null, q.manpower_ar ?? null, q.mobilization ?? null, q.mobilization_ar ?? null, q.duration ?? null, q.duration_ar ?? null,
          q.bank_details ?? null, q.bank_details_ar ?? null, q.footer ?? null, q.footer_ar ?? null,
          q.custom_field_header ?? 'CUSTOM:', q.custom_field ?? null, q.custom_field_ar ?? null,
          q.status ?? 'Draft', q.type ?? 'Quotation', q.revision_of ?? null, q.author_id ?? null, q.vat_rate ?? 15
        );
      }

      const insertQuoteItem = db.prepare('INSERT INTO quote_items (id, quote_id, product_id, description, description_ar, qty, unit, unit_price, net_price) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
      for (const qi of quote_items || []) insertQuoteItem.run(qi.id, qi.quote_id, qi.product_id ?? null, qi.description ?? null, qi.description_ar ?? null, qi.qty ?? 0, qi.unit ?? null, qi.unit_price ?? 0, qi.net_price ?? 0);
    })();
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Settings / System
app.get('/api/admin/backup', requireAuth, requireAdmin, (req, res) => {
  const file = path.resolve(process.cwd(), 'quotes.db');
  res.download(file, `AJ_Network_DB_Backup_${new Date().toISOString().split('T')[0]}.db`);
});

// Settings
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

// Translation API
app.post('/api/translate', requireAuth, async (req, res) => {
  const { text } = req.body;
  if (!text) return res.json({ translation: '' });

  try {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=ar&dt=t&q=${encodeURIComponent(text)}`;
    const response = await fetch(url);
    const data = await response.json();

    // Google Translate returns an array where the first element is an array of translated segments.
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
