// Date helpers that understand every format found in quote data: ISO strings, full timestamps and
// Excel serial numbers (from imported sheets). All results use LOCAL time, never UTC.

export function parseQuoteDate(raw: unknown): Date | null {
  if (raw === null || raw === undefined || raw === '') return null;
  const s = String(raw).trim();
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
  if (/^\d{4,6}(\.\d+)?$/.test(s)) {
    const serial = Number(s);
    if (serial > 20000 && serial < 80000) return new Date(Date.UTC(1899, 11, 30) + serial * 86400000 + new Date().getTimezoneOffset() * 60000);
  }
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

/** "YYYY-MM" for a quote date, or '' when it cannot be read. */
export function monthKeyOf(raw: unknown): string {
  const d = parseQuoteDate(raw);
  return d ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` : '';
}

/** "YYYY-MM-DD" in local time, or '' when unreadable. */
export function ymdOf(raw: unknown): string {
  const d = parseQuoteDate(raw);
  return d ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` : '';
}

// ---- local-calendar helpers (session fixes 2026-11-03) ----

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
