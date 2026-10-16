// Duplicate detection for CSV imports. Shared by the browser preview and the server so both agree.

/** Digits only; a leading country code (966 / 00966 / 0) is ignored so 0501234567 and +966501234567 match. */
export function normalizePhone(raw: string | null | undefined): string {
  let d = String(raw ?? '').replace(/\D+/g, '');
  if (d.startsWith('00')) d = d.slice(2);
  if (d.startsWith('966')) d = d.slice(3);
  if (d.startsWith('0')) d = d.slice(1);
  return d;
}

export const normalizeName = (raw: string | null | undefined): string =>
  String(raw ?? '').toLowerCase().replace(/[^a-z0-9؀-ۿ]+/g, ' ').trim();

export interface CustomerLike { name?: string | null; mobile?: string | null; email?: string | null }

/** Two customers are duplicates when they share a (long enough) mobile number, an e-mail, or the exact normalised name. */
export function customerKeys(c: CustomerLike): string[] {
  const keys: string[] = [];
  const phone = normalizePhone(c.mobile);
  if (phone.length >= 7) keys.push('tel:' + phone);
  const email = String(c.email ?? '').trim().toLowerCase();
  if (email) keys.push('mail:' + email);
  const name = normalizeName(c.name);
  if (name) keys.push('name:' + name);
  return keys;
}

export interface ProductLike { description?: string | null; item_code?: string | null }

/** Products match on item code when present, otherwise on the normalised description. */
export function productKey(p: ProductLike): string {
  const code = String(p.item_code ?? '').trim().toLowerCase();
  return code ? 'code:' + code : 'desc:' + normalizeName(p.description);
}

/**
 * Marks each incoming record as 'new', 'duplicate' (already exists) or 'repeat' (appears earlier in the same file).
 * `existingKeys` is the set of keys of records already in the database.
 */
export function classify<T>(records: T[], keysOf: (r: T) => string[], existingKeys: Set<string>): Array<'new' | 'duplicate' | 'repeat'> {
  const seen = new Set<string>();
  return records.map(r => {
    const keys = keysOf(r);
    if (keys.some(k => existingKeys.has(k))) return 'duplicate';
    if (keys.some(k => seen.has(k))) return 'repeat';
    keys.forEach(k => seen.add(k));
    return 'new';
  });
}
