import { describe, it, expect } from 'vitest';
import { matchItems, sameValue } from './quoteDiff';

describe('matchItems', () => {
  it('does not flag every row when a line is inserted at the top', () => {
    const older = [{ description: 'Cable', qty: 1, unit_price: 10 }, { description: 'Switch', qty: 2, unit_price: 50 }];
    const newer = [{ description: 'Router', qty: 1, unit_price: 99 }, ...older];
    const pairs = matchItems(older, newer);
    expect(pairs.map(p => p.status)).toEqual(['same', 'same', 'added']);
  });
  it('detects removed and changed lines', () => {
    const older = [{ description: 'Cable', qty: 1, unit_price: 10 }, { description: 'Switch', qty: 2, unit_price: 50 }];
    const newer = [{ description: 'cable', qty: 3, unit_price: 10 }];
    const pairs = matchItems(older, newer);
    expect(pairs[0].status).toBe('changed');
    expect(pairs[0].changed.qty).toBe(true);
    expect(pairs[1].status).toBe('removed');
  });
  it('prefers item code over description', () => {
    const pairs = matchItems([{ item_code: 'A1', description: 'Old name', qty: 1, unit_price: 5 }], [{ item_code: 'a1', description: 'New name', qty: 1, unit_price: 5 }]);
    expect(pairs[0].status).toBe('changed');
    expect(pairs[0].changed.description).toBe(true);
  });
  it('pairs duplicate descriptions in order', () => {
    const items = [{ description: 'Pole', qty: 1, unit_price: 1 }, { description: 'Pole', qty: 2, unit_price: 1 }];
    expect(matchItems(items, items).map(p => p.status)).toEqual(['same', 'same']);
  });
});

describe('sameValue', () => {
  it('treats empty values as equal and compares money to the cent', () => {
    expect(sameValue(null, '')).toBe(true);
    expect(sameValue(undefined, null)).toBe(true);
    expect(sameValue(10.001, 10)).toBe(true);
    expect(sameValue(10.01, 10)).toBe(false);
    expect(sameValue('Draft', 'draft')).toBe(true);
  });
});
