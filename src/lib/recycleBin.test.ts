import { describe, it, expect } from 'vitest';
import { parseRecycleBinDays, recycleBinCutoff, describeRecycleBinDays } from './recycleBin';

describe('recycleBin retention', () => {
  it('keeps 0 as "never" instead of falling back to 30', () => {
    expect(parseRecycleBinDays('0')).toBe(0);
    expect(recycleBinCutoff(0)).toBeNull();
    expect(describeRecycleBinDays(0)).toMatch(/off/);
  });
  it('defaults missing or invalid values to 30', () => {
    expect(parseRecycleBinDays(undefined)).toBe(30);
    expect(parseRecycleBinDays('')).toBe(30);
    expect(parseRecycleBinDays('abc')).toBe(30);
    expect(parseRecycleBinDays('-5')).toBe(30);
  });
  it('computes the cutoff', () => {
    const now = Date.UTC(2026, 0, 31);
    expect(parseRecycleBinDays('7')).toBe(7);
    expect(recycleBinCutoff(7, now)).toBe('2026-01-24T00:00:00.000Z');
  });
});
