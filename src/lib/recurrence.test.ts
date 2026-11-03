import { describe, it, expect } from 'vitest';
import { nextRunDate, dueRunDates } from './recurrence';

describe('recurrence', () => {
  it('adds weeks, months, quarters and years', () => {
    expect(nextRunDate('2026-10-16', 'weekly')).toBe('2026-10-23');
    expect(nextRunDate('2026-10-16', 'monthly')).toBe('2026-11-16');
    expect(nextRunDate('2026-10-16', 'quarterly')).toBe('2027-01-16');
    expect(nextRunDate('2026-10-16', 'yearly')).toBe('2027-10-16');
  });
  it('clamps month ends and returns to the anchor day afterwards', () => {
    expect(nextRunDate('2026-01-31', 'monthly')).toBe('2026-02-28');
    expect(nextRunDate('2028-01-31', 'monthly')).toBe('2028-02-29');
    expect(nextRunDate('2026-02-28', 'monthly', 31)).toBe('2026-03-31');
    expect(nextRunDate('2026-03-31', 'monthly', 31)).toBe('2026-04-30');
  });
  it('lists every due run, capped', () => {
    expect(dueRunDates('2026-08-01', 'monthly', '2026-10-16')).toEqual(['2026-08-01', '2026-09-01', '2026-10-01']);
    expect(dueRunDates('2026-11-01', 'monthly', '2026-10-16')).toEqual([]);
    expect(dueRunDates('2020-01-01', 'weekly', '2026-10-16', undefined, 5)).toHaveLength(5);
  });
});
