// =============================================================================
// dates.ts — LOCAL calendar dates (the user's own time zone, e.g. Asia/Riyadh)
// =============================================================================
// `new Date().toISOString()` is UTC: between 00:00 and 03:00 in Riyadh it still returns
// yesterday's date. Quotes, "this month" and follow-ups must use the local calendar.

const pad = (n: number) => String(n).padStart(2, '0');

/** YYYY-MM-DD in local time */
export function localDate(d: Date = new Date()): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** YYYY-MM in local time */
export function localMonth(d: Date = new Date()): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}

/** local date + n days (YYYY-MM-DD) */
export function localDatePlusDays(days: number, from: Date = new Date()): string {
  const d = new Date(from.getFullYear(), from.getMonth(), from.getDate() + days);
  return localDate(d);
}

/**
 * Accepts YYYY-MM-DD, ISO timestamps and Excel serial numbers ("45418.0" from old imports)
 * and returns YYYY-MM-DD ('' when unknown).
 */
export function normalizeDate(value: any): string {
  if (value === null || value === undefined) return '';
  const s = String(value).trim();
  if (!s) return '';
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  if (/^\d{5}(\.\d+)?$/.test(s)) {
    const serial = Math.floor(Number(s));
    if (serial > 20000 && serial < 100000) {
      // Excel day 0 = 1899-12-30 (UTC arithmetic, no time zone shift)
      return new Date(Date.UTC(1899, 11, 30) + serial * 86400000).toISOString().slice(0, 10);
    }
  }
  const d = new Date(s);
  return isNaN(d.getTime()) ? '' : localDate(d);
}
