import { describe, it, expect } from 'vitest';
import { normalizePhone, customerKeys, productKey, classify } from './importDedupe';

describe('importDedupe', () => {
  it('treats the same Saudi number in different formats as equal', () => {
    expect(normalizePhone('0501234567')).toBe('501234567');
    expect(normalizePhone('+966 50 123 4567')).toBe('501234567');
    expect(normalizePhone('00966501234567')).toBe('501234567');
  });
  it('matches customers by phone, email or name', () => {
    const existing = new Set(customerKeys({ name: 'Acme Co', mobile: '0501234567', email: 'a@acme.com' }));
    const rows = [
      { name: 'Different', mobile: '+966501234567' },
      { name: 'acme  co.' },
      { name: 'Other', email: 'A@ACME.COM' },
      { name: 'Brand new', mobile: '0555555555' },
      { name: 'Brand NEW', mobile: '' },
    ];
    expect(classify(rows, customerKeys, existing)).toEqual(['duplicate', 'duplicate', 'duplicate', 'new', 'repeat']);
  });
  it('ignores very short phone numbers as keys', () => {
    expect(customerKeys({ name: 'X', mobile: '123' })).toEqual(['name:x']);
  });
  it('products match on item code first, else description', () => {
    expect(productKey({ item_code: ' AB-1 ', description: 'x' })).toBe('code:ab-1');
    expect(productKey({ description: 'CAT6 Cable  (305m)' })).toBe('desc:cat6 cable 305m');
  });
});
