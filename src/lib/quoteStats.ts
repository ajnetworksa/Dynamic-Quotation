// =============================================================================
// quoteStats.ts — rules for counting quotations in Dashboard / Customer totals
// =============================================================================
// • A revision (AJ-57224-R1, -R2 …) replaces the earlier version → only the LATEST revision counts.
// • Won  = Accepted or Invoiced (an invoiced quote stays won).
// • Lost = Rejected or Cancelled.
// • Open = Draft or Sent (or no status).
// • Amounts are TOTAL PACKAGE (incl. VAT), i.e. what the customer pays.

export const WON_STATUSES = ['Accepted', 'Invoiced'];
export const LOST_STATUSES = ['Rejected', 'Cancelled'];

export function baseQuoteId(id: string): string {
  return String(id || '').replace(/-R\d+$/i, '');
}

export function revisionNumber(id: string): number {
  const m = String(id || '').match(/-R(\d+)$/i);
  return m ? parseInt(m[1], 10) : 0;
}

/** Keeps only the newest revision of every quotation */
export function latestRevisions<T extends { quote_id: string }>(quotes: T[]): T[] {
  const best = new Map<string, T>();
  for (const q of quotes) {
    const key = baseQuoteId(q.quote_id);
    const cur = best.get(key);
    if (!cur || revisionNumber(q.quote_id) > revisionNumber(cur.quote_id)) best.set(key, q);
  }
  return quotes.filter(q => best.get(baseQuoteId(q.quote_id)) === q);
}

export const isWon = (status?: string | null) => WON_STATUSES.includes(status || '');
export const isLost = (status?: string | null) => LOST_STATUSES.includes(status || '');
export const isOpen = (status?: string | null) => !status || status === 'Draft' || status === 'Sent';
