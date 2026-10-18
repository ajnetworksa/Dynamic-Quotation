import { describe, it, expect } from 'vitest';
import { inRange, followUpsDue, expiringSoon, lossReasons, openQuoteAging, rangeStart } from './dashboardStats';

const NOW = new Date(2026, 9, 16); // 16 Oct 2026

describe('dashboard stats', () => {
  it('filters by range', () => {
    const q = [{ date: '2026-10-02' }, { date: '2026-08-20' }, { date: '2025-12-31' }, { date: '' }];
    expect(inRange(q, 'month', NOW)).toHaveLength(1);
    expect(inRange(q, '90d', NOW)).toHaveLength(2);
    expect(inRange(q, 'year', NOW)).toHaveLength(2);
    expect(inRange(q, '12m', NOW)).toHaveLength(3);
    expect(inRange(q, 'all', NOW)).toHaveLength(4);
    expect(rangeStart('all')).toBeNull();
  });
  it('lists open quotes with due follow-ups, most overdue first', () => {
    const q = [
      { quote_id: 'A', status: 'Sent', followup_date: '2026-10-10' },
      { quote_id: 'B', status: 'Draft', followup_date: '2026-10-16' },
      { quote_id: 'C', status: 'Sent', followup_date: '2026-10-30' },
      { quote_id: 'D', status: 'Accepted', followup_date: '2026-10-01' },
    ];
    expect(followUpsDue(q, NOW).map(x => x.quote_id)).toEqual(['A', 'B']);
  });
  it('finds sent quotes that expired or expire within a week', () => {
    const q = [
      { quote_id: 'A', status: 'Sent', expiry_date: '2026-10-14' },
      { quote_id: 'B', status: 'Sent', expiry_date: '2026-10-20' },
      { quote_id: 'C', status: 'Sent', expiry_date: '2026-11-30' },
      { quote_id: 'D', status: 'Draft', expiry_date: '2026-10-17' },
    ];
    const r = expiringSoon(q, 7, NOW);
    expect(r.map(x => [x.quote_id, x.daysLeft])).toEqual([['A', -2], ['B', 4]]);
  });
  it('counts loss reasons case-insensitively', () => {
    const q = [
      { quote_id: '1', status: 'Rejected', lost_reason: 'Price too high' },
      { quote_id: '2', status: 'Rejected', lost_reason: 'price too high ' },
      { quote_id: '3', status: 'Rejected', lost_reason: 'Competitor' },
      { quote_id: '4', status: 'Rejected', lost_reason: '' },
      { quote_id: '5', status: 'Accepted', lost_reason: 'ignored' },
    ];
    expect(lossReasons(q)).toEqual([{ reason: 'Price too high', count: 2 }, { reason: 'Competitor', count: 1 }]);
  });
  it('buckets open quotes by age', () => {
    const q = [
      { quote_id: '1', status: 'Sent', date: '2026-10-15' },
      { quote_id: '2', status: 'Draft', date: '2026-09-20' },
      { quote_id: '3', status: 'Sent', date: '2026-08-01' },
      { quote_id: '4', status: 'Sent', date: '2025-01-01' },
      { quote_id: '5', status: 'Accepted', date: '2025-01-01' },
    ];
    expect(openQuoteAging(q, NOW).map(b => b.count)).toEqual([1, 1, 1, 1]);
  });
});
