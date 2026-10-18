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
