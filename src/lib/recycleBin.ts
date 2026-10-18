// Recycle Bin retention (`recycleBinDays` setting). 0 means "never auto-clear".

export const DEFAULT_RECYCLE_BIN_DAYS = 30;

export const RECYCLE_BIN_DAY_OPTIONS: { value: number; label: string }[] = [
  { value: 7, label: '7 days' },
  { value: 14, label: '14 days' },
  { value: 30, label: '30 days' },
  { value: 60, label: '60 days' },
  { value: 90, label: '90 days' },
  { value: 0, label: 'Never (manual only)' },
];

/** Parses the stored setting. Missing or invalid values fall back to the default; 0 is kept (never). */
export function parseRecycleBinDays(value: unknown): number {
  if (value === null || value === undefined || String(value).trim() === '') return DEFAULT_RECYCLE_BIN_DAYS;
  const n = parseInt(String(value), 10);
  if (!Number.isFinite(n) || n < 0) return DEFAULT_RECYCLE_BIN_DAYS;
  return n;
}

/** ISO cutoff before which binned quotes are purged, or null when auto-clear is off. */
export function recycleBinCutoff(days: number, now: number = Date.now()): string | null {
  if (!(days > 0)) return null;
  return new Date(now - days * 24 * 60 * 60 * 1000).toISOString();
}

export function describeRecycleBinDays(days: number): string {
  return days > 0 ? `Auto-clear after ${days} day${days === 1 ? '' : 's'}` : 'Auto-clear off (manual only)';
}
