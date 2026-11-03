import { describe, it, expect } from 'vitest';
import { parseQuoteDate, monthKeyOf, ymdOf } from './dates';

describe('dates', () => {
  it('reads ISO dates and timestamps without timezone shift', () => {
    expect(ymdOf('2026-03-31')).toBe('2026-03-31');
    expect(monthKeyOf('2026-03-31T23:30:00.000Z')).toBe('2026-03');
  });
  it('reads Excel serial dates', () => {
    expect(ymdOf('45000')).toBe('2023-03-15');
  });
  it('returns empty for junk', () => {
    expect(monthKeyOf('')).toBe('');
    expect(monthKeyOf('not a date')).toBe('');
    expect(parseQuoteDate(null)).toBeNull();
  });
});
