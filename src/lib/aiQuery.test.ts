import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Database from 'better-sqlite3';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { checkAiSql, runAiQuery } from './aiQuery';

let dir: string;
let dbPath: string;

beforeAll(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aiq-'));
  dbPath = path.join(dir, 'q.db');
  const db = new Database(dbPath);
  db.exec(`
    CREATE TABLE customers (id INTEGER PRIMARY KEY, name TEXT, address TEXT, contact TEXT, mobile TEXT, email TEXT);
    CREATE TABLE quotes (id INTEGER PRIMARY KEY, quote_id TEXT, date TEXT, customer_id INTEGER, subject TEXT, subtotal REAL,
      tax REAL, grand_total REAL, status TEXT, markup REAL, author_id INTEGER, deleted_at TEXT, draft_data TEXT, shared_with TEXT);
    CREATE TABLE quote_items (id INTEGER PRIMARY KEY, quote_id TEXT, product_id INTEGER, description TEXT, qty REAL, unit TEXT,
      unit_price REAL, net_price REAL, original_price REAL, manual_price REAL);
    CREATE TABLE sessions (token TEXT, user_id INTEGER);
    INSERT INTO customers (name) VALUES ('Acme');
    INSERT INTO quotes (quote_id, author_id, grand_total, status) VALUES ('A-1', 1, 100, 'Sent'), ('A-2', 2, 200, 'Accepted');
    INSERT INTO quotes (quote_id, author_id, grand_total, status, deleted_at) VALUES ('A-3', 1, 300, 'Draft', '2026-01-01');
    INSERT INTO quote_items (quote_id, description, net_price) VALUES ('A-1', 'cable', 10), ('A-2', 'switch', 20);
    INSERT INTO sessions VALUES ('secret-token', 1);
  `);
  db.close();
});
afterAll(() => fs.rmSync(dir, { recursive: true, force: true }));

describe('checkAiSql', () => {
  it('accepts a plain select', () => {
    expect(checkAiSql('SELECT status, COUNT(*) FROM quotes GROUP BY status')).toBeNull();
  });
  it.each([
    'DELETE FROM quotes',
    'SELECT * FROM sessions',
    'SELECT token FROM quotes',
    'SELECT * FROM main.users',
    'SELECT * FROM quotes; SELECT * FROM users',
    'SELECT * FROM quotes -- comment',
    'SELECT * FROM sqlite_master',
    'PRAGMA table_info(quotes)',
  ])('rejects %s', (sql) => {
    expect(checkAiSql(sql)).not.toBeNull();
  });
});

describe('runAiQuery', () => {
  it('non-admin only sees own, non-deleted quotes (even with OR 1=1)', () => {
    const user = { id: 1, role: 'user', permissions: {} };
    const rows = runAiQuery(dbPath, user, 'SELECT quote_id FROM quotes WHERE 1=1 OR author_id = 2');
    expect(rows.map(r => r.quote_id)).toEqual(['A-1']);
  });
  it('non-admin only sees items of own quotes', () => {
    const rows = runAiQuery(dbPath, { id: 1, role: 'user' }, 'SELECT description FROM quote_items');
    expect(rows.map(r => r.description)).toEqual(['cable']);
  });
  it('admin sees all non-deleted quotes', () => {
    const rows = runAiQuery(dbPath, { id: 9, role: 'admin' }, 'SELECT quote_id FROM quotes ORDER BY quote_id');
    expect(rows.map(r => r.quote_id)).toEqual(['A-1', 'A-2']);
  });
  it('cannot reach other tables', () => {
    expect(() => runAiQuery(dbPath, { id: 9, role: 'admin' }, 'SELECT * FROM sessions')).toThrow();
  });
  it('cannot write', () => {
    expect(() => runAiQuery(dbPath, { id: 9, role: 'admin' }, 'SELECT 1; DELETE FROM quotes')).toThrow();
  });
});
