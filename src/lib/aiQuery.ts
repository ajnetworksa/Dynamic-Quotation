// Safe execution of model-written SQL for the AI assistant.
//
// Defence in depth:
//  1. a text guard rejects anything that is not one plain SELECT over the three public tables;
//  2. the query runs on a SEPARATE read-only connection with query_only=ON;
//  3. on that connection quotes / quote_items / customers are TEMP views that expose only safe columns and,
//     for users who may not see all quotes, only their own non-deleted quotes. Nothing else is reachable
//     because the guard blocks qualified names (main.x / temp.x) and every other table name.
import Database from 'better-sqlite3';

export interface AiUser {
  id: number;
  role: string;
  permissions?: { canViewAllQuotes?: boolean };
}

const FORBIDDEN: RegExp[] = [
  /\busers\b/i, /\bsettings\b/i, /\bactivity_log\b/i, /\bsessions\b/i, /\bsystem_logs\b/i, /\bpermission_groups\b/i,
  /\bid_reservations\b/i, /\bsuppliers\b/i, /\bproducts\b/i,
  /sqlite_/i, /\bpragma\b/i, /\battach\b/i, /\bdetach\b/i, /load_extension/i,
  /\b(insert|update|delete|drop|alter|create|replace|vacuum|reindex)\b/i,
  /\b(main|temp)\s*\./i, // qualified names would bypass the filtered views
  /\btoken\b/i, /\bpassword\b/i, /\bdraft_data\b/i, /\bshared_with\b/i,
];

/** Returns null when the SQL is acceptable, otherwise a short reason. */
export function checkAiSql(sql: string): string | null {
  const q = sql.trim().replace(/;\s*$/, '');
  if (!/^select\b/i.test(q)) return 'only SELECT queries are allowed';
  if (q.includes(';')) return 'multiple statements are not allowed';
  if (/--|\/\*/.test(q)) return 'comments are not allowed';
  if (q.length > 4000) return 'query too long';
  for (const re of FORBIDDEN) if (re.test(q)) return 'query touches data that is not available to the assistant';
  return null;
}

/** Runs the (already guarded) SQL read-only with per-user row filtering. Returns at most `limit` rows. */
export function runAiQuery(dbPath: string, user: AiUser, sql: string, limit = 200): any[] {
  const reason = checkAiSql(sql);
  if (reason) throw new Error(`blocked: ${reason}`);

  const canSeeAll = user.role === 'admin' || !!user.permissions?.canViewAllQuotes;
  const uid = Number(user.id);
  if (!canSeeAll && !Number.isInteger(uid)) throw new Error('blocked: invalid user');
  const own = canSeeAll ? '' : `AND author_id = ${uid}`;

  const ro = new Database(dbPath, { readonly: true, fileMustExist: true });
  try {
    ro.exec(`
      CREATE TEMP VIEW quotes AS
        SELECT id, quote_id, date, customer_id, subject, subtotal, tax, grand_total, status, markup, author_id
        FROM main.quotes WHERE deleted_at IS NULL ${own};
      CREATE TEMP VIEW customers AS
        SELECT id, name, address, contact, mobile, email FROM main.customers;
      CREATE TEMP VIEW quote_items AS
        SELECT id, quote_id, product_id, description, qty, unit, unit_price, net_price, original_price, manual_price
        FROM main.quote_items
        WHERE quote_id IN (SELECT quote_id FROM main.quotes WHERE deleted_at IS NULL ${own});
    `);
    // Views are created first; from here on the connection can no longer write anything.
    ro.pragma('query_only = ON');
    const inner = sql.trim().replace(/;\s*$/, '');
    return ro.prepare(`SELECT * FROM (${inner}) LIMIT ${Math.max(1, Math.min(1000, limit))}`).all();
  } finally {
    ro.close();
  }
}
