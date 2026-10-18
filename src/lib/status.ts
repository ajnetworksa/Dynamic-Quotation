// Single source of truth for quote statuses (used by Kanban, Tracking, Dashboard and the server schema).

export const STATUSES = ['Draft', 'Sent', 'Accepted', 'Rejected', 'Invoiced', 'Cancelled'] as const;
export type Status = typeof STATUSES[number];

export const STATUS_BADGE: Record<Status, string> = {
  Draft: 'bg-gray-100 text-gray-800',
  Sent: 'bg-yellow-100 text-yellow-800',
  Accepted: 'bg-green-100 text-green-800',
  Rejected: 'bg-red-100 text-red-800',
  Invoiced: 'bg-purple-100 text-purple-800',
  Cancelled: 'bg-gray-200 text-gray-600',
};

export const isStatus = (s: unknown): s is Status => typeof s === 'string' && (STATUSES as readonly string[]).includes(s);

/** Unknown / missing statuses are treated as Draft so a record never disappears from a view. */
export const normalizeStatus = (s: unknown): Status => (isStatus(s) ? s : 'Draft');

/** Statuses that count as won business. */
export const WON_STATUSES: readonly Status[] = ['Accepted', 'Invoiced'];
export const isWon = (s: unknown) => WON_STATUSES.includes(normalizeStatus(s));

interface RevisionLike {
  quote_id: string;
  revision_of?: string | null;
  status?: string | null;
  grand_total?: number | null;
}

/**
 * Won quotes without double counting: a quote that has been superseded by another record pointing at it
 * through `revision_of` (a later revision or the invoice converted from it) is skipped when that newer
 * record is itself won, so the revenue is counted once.
 */
export function wonQuotes<T extends RevisionLike>(quotes: T[]): T[] {
  const supersededBy = new Map<string, T[]>();
  for (const q of quotes) {
    if (q.revision_of) {
      const list = supersededBy.get(q.revision_of) || [];
      list.push(q);
      supersededBy.set(q.revision_of, list);
    }
  }
  return quotes.filter(q => {
    if (!isWon(q.status)) return false;
    const newer = supersededBy.get(q.quote_id) || [];
    return !newer.some(n => isWon(n.status));
  });
}
