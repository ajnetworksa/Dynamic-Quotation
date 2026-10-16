// Date arithmetic for recurring invoices (pure, unit-tested).

export type Frequency = 'weekly' | 'monthly' | 'quarterly' | 'yearly';
export const FREQUENCIES: Frequency[] = ['weekly', 'monthly', 'quarterly', 'yearly'];

const pad = (n: number) => String(n).padStart(2, '0');
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parse = (s: string) => { const [y, m, d] = s.slice(0, 10).split('-').map(Number); return new Date(y, m - 1, d); };

/** Adds whole calendar months, clamping to the last day (31 Jan + 1 month = 28/29 Feb, not 3 Mar). */
function addMonths(date: Date, months: number): Date {
  const target = new Date(date.getFullYear(), date.getMonth() + months, 1);
  const last = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  return new Date(target.getFullYear(), target.getMonth(), Math.min(date.getDate(), last));
}

/** The date after `from` for the given frequency. `anchorDay` keeps month-end schedules on their original day (e.g. the 31st). */
export function nextRunDate(from: string, frequency: Frequency, anchorDay?: number): string {
  const d = parse(from);
  if (frequency === 'weekly') return ymd(new Date(d.getFullYear(), d.getMonth(), d.getDate() + 7));
  const months = frequency === 'monthly' ? 1 : frequency === 'quarterly' ? 3 : 12;
  const next = addMonths(d, months);
  if (anchorDay && anchorDay > next.getDate()) {
    const last = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
    return ymd(new Date(next.getFullYear(), next.getMonth(), Math.min(anchorDay, last)));
  }
  return ymd(next);
}

/** All run dates that are due (<= today), oldest first, capped so a long outage cannot create a flood of documents. */
export function dueRunDates(nextRun: string, frequency: Frequency, today: string, anchorDay?: number, cap = 12): string[] {
  const out: string[] = [];
  let cur = nextRun;
  while (cur <= today && out.length < cap) {
    out.push(cur);
    cur = nextRunDate(cur, frequency, anchorDay);
  }
  return out;
}
