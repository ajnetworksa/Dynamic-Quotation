// Pure helpers for comparing two versions of a quote (used by QuoteDiffViewer, unit-tested).

export interface DiffItem {
  description?: string | null;
  item_code?: string | null;
  qty?: number | null;
  unit?: string | null;
  unit_price?: number | null;
  net_price?: number | null;
}

export interface ItemPair {
  i1: DiffItem | null;
  i2: DiffItem | null;
  status: 'same' | 'changed' | 'added' | 'removed';
  changed: { description: boolean; qty: boolean; unit: boolean; price: boolean };
}

const norm = (s: unknown) => String(s ?? '').toLowerCase().replace(/\s+/g, ' ').trim();
const keyOf = (i: DiffItem) => (i.item_code && norm(i.item_code)) || norm(i.description);
const num = (v: unknown) => Math.round((Number(v) || 0) * 100) / 100;

/**
 * Pairs the items of two versions by item code (or description) instead of by row position, so inserting
 * or deleting one line no longer marks every following line as changed. Duplicate keys are paired in order.
 */
export function matchItems(older: DiffItem[], newer: DiffItem[]): ItemPair[] {
  const pool = new Map<string, number[]>();
  newer.forEach((it, idx) => {
    const k = keyOf(it);
    pool.set(k, [...(pool.get(k) || []), idx]);
  });
  const used = new Set<number>();
  const pairs: ItemPair[] = [];

  for (const i1 of older) {
    const idx = (pool.get(keyOf(i1)) || []).find(n => !used.has(n));
    if (idx === undefined) {
      pairs.push({ i1, i2: null, status: 'removed', changed: { description: false, qty: false, unit: false, price: false } });
      continue;
    }
    used.add(idx);
    const i2 = newer[idx];
    const changed = {
      description: norm(i1.description) !== norm(i2.description),
      qty: num(i1.qty) !== num(i2.qty),
      unit: norm(i1.unit) !== norm(i2.unit),
      price: num(i1.unit_price) !== num(i2.unit_price),
    };
    pairs.push({ i1, i2, status: Object.values(changed).some(Boolean) ? 'changed' : 'same', changed });
  }
  newer.forEach((i2, idx) => {
    if (!used.has(idx)) pairs.push({ i1: null, i2, status: 'added', changed: { description: false, qty: false, unit: false, price: false } });
  });
  return pairs;
}

/** Loose equality for header values: null / undefined / '' are the same, numbers compare to the cent. */
export function sameValue(a: unknown, b: unknown): boolean {
  const empty = (v: unknown) => v === null || v === undefined || v === '';
  if (empty(a) && empty(b)) return true;
  if (typeof a === 'number' || typeof b === 'number') return num(a) === num(b);
  return norm(a) === norm(b);
}
