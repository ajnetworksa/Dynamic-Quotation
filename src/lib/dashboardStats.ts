// Pure helpers behind the dashboard widgets (date range, follow-ups, expiry, loss reasons, aging). Unit-tested.
import { parseQuoteDate, ymdOf } from './dates';
import { normalizeStatus } from './status';

export type RangeKey = 'all' | 'month' | '90d' | '12m' | 'year';

export const RANGE_LABELS: Record<RangeKey, string> = {
  all: 'All time',
  month: 'This month',
  '90d': 'Last 90 days',
  '12m': 'Last 12 months',
  year: 'This year',
};

/** First day (local, inclusive) of a range, or null for "all". */
export function rangeStart(range: RangeKey, now = new Date()): Date | null {
  switch (range) {
    case 'month': return new Date(now.getFullYear(), now.getMonth(), 1);
    case '90d': return new Date(now.getFullYear(), now.getMonth(), now.getDate() - 89);
    case '12m': return new Date(now.getFullYear(), now.getMonth() - 11, 1);
    case 'year': return new Date(now.getFullYear(), 0, 1);
    default: return null;
  }
}

export function inRange<T extends { date?: string | null }>(quotes: T[], range: RangeKey, now = new Date()): T[] {
  const start = rangeStart(range, now);
  if (!start) return quotes;
  return quotes.filter(q => { const d = parseQuoteDate(q.date); return !!d && d >= start && d <= now; });
}

interface Q {
  quote_id: string;
  status?: string | null;
  date?: string | null;
  followup_date?: string | null;
  expiry_date?: string | null;
  lost_reason?: string | null;
}
const isOpen = (q: Q) => ['Draft', 'Sent'].includes(normalizeStatus(q.status));

/** Open quotes whose follow-up date is today or earlier, most overdue first. */
export function followUpsDue<T extends Q>(quotes: T[], now = new Date()): T[] {
  const today = ymdOf(now);
  return quotes
    .filter(q => isOpen(q) && q.followup_date && ymdOf(q.followup_date) !== '' && ymdOf(q.followup_date) <= today)
    .sort((a, b) => ymdOf(a.followup_date).localeCompare(ymdOf(b.followup_date)));
}

/** Sent quotes that have expired or expire within `days`, soonest first. */
export function expiringSoon<T extends Q>(quotes: T[], days = 7, now = new Date()): Array<T & { daysLeft: number }> {
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const out: Array<T & { daysLeft: number }> = [];
  for (const q of quotes) {
    if (normalizeStatus(q.status) !== 'Sent') continue;
    const d = parseQuoteDate(q.expiry_date);
    if (!d) continue;
    const daysLeft = Math.round((new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() - startOfToday) / 86400000);
    if (daysLeft <= days) out.push({ ...q, daysLeft });
  }
  return out.sort((a, b) => a.daysLeft - b.daysLeft);
}

/** Most common rejection reasons (case-insensitive), top `limit`. */
export function lossReasons(quotes: Q[], limit = 5): Array<{ reason: string; count: number }> {
  const counts = new Map<string, { reason: string; count: number }>();
  for (const q of quotes) {
    if (normalizeStatus(q.status) !== 'Rejected') continue;
    const reason = (q.lost_reason || '').trim();
    if (!reason) continue;
    const key = reason.toLowerCase();
    const cur = counts.get(key) || { reason, count: 0 };
    cur.count++;
    counts.set(key, cur);
  }
  return [...counts.values()].sort((a, b) => b.count - a.count).slice(0, limit);
}

/** How long open (Draft/Sent) quotes have been waiting, in age buckets. */
export function openQuoteAging(quotes: Q[], now = new Date()): Array<{ label: string; count: number }> {
  const buckets = [
    { label: '0-7 days', max: 7, count: 0 },
    { label: '8-30 days', max: 30, count: 0 },
    { label: '31-90 days', max: 90, count: 0 },
    { label: '90+ days', max: Infinity, count: 0 },
  ];
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  for (const q of quotes) {
    if (!isOpen(q)) continue;
    const d = parseQuoteDate(q.date);
    if (!d) continue;
    const age = Math.max(0, Math.round((today - new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()) / 86400000));
    buckets.find(b => age <= b.max)!.count++;
  }
  return buckets.map(({ label, count }) => ({ label, count }));
}
