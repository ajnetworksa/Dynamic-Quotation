import { describe, it, expect } from 'vitest';
import { normalizeStatus, isWon, wonQuotes } from './status';

describe('status helpers', () => {
  it('normalises unknown statuses to Draft', () => {
    expect(normalizeStatus(null)).toBe('Draft');
    expect(normalizeStatus('weird')).toBe('Draft');
    expect(normalizeStatus('Invoiced')).toBe('Invoiced');
  });
  it('counts Accepted and Invoiced as won', () => {
    expect(isWon('Accepted')).toBe(true);
    expect(isWon('Invoiced')).toBe(true);
    expect(isWon('Sent')).toBe(false);
  });
  it('does not double count a quote and its converted invoice', () => {
    const rows = [
      { quote_id: 'A-1', status: 'Accepted', grand_total: 100 },
      { quote_id: 'A-1-INV', revision_of: 'A-1', status: 'Invoiced', grand_total: 100 },
      { quote_id: 'B-1', status: 'Accepted', grand_total: 50 },
    ];
    expect(wonQuotes(rows).map(r => r.quote_id)).toEqual(['A-1-INV', 'B-1']);
  });
  it('keeps the earlier quote if the newer revision is not won', () => {
    const rows = [
      { quote_id: 'A-1', status: 'Accepted' },
      { quote_id: 'A-1-R2', revision_of: 'A-1', status: 'Draft' },
    ];
    expect(wonQuotes(rows).map(r => r.quote_id)).toEqual(['A-1']);
  });
});
