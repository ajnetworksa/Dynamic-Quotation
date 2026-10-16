// Small RFC 4180 CSV reader + column mapper used by the customer / product import screens.

/** Detects the delimiter (comma, semicolon or tab) from the first line, ignoring quoted text. */
export function detectDelimiter(text: string): string {
  const firstLine = text.split(/\r?\n/)[0] || '';
  let inQuotes = false;
  const counts: Record<string, number> = { ',': 0, ';': 0, '\t': 0 };
  for (const ch of firstLine) {
    if (ch === '"') inQuotes = !inQuotes;
    else if (!inQuotes && ch in counts) counts[ch]++;
  }
  return (Object.entries(counts).sort((a, b) => b[1] - a[1])[0][1] > 0) ? Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0] : ',';
}

/** Parses CSV text into rows of cells. Handles quotes, escaped quotes (""), embedded newlines and a leading BOM. */
export function parseCsv(input: string, delimiter?: string): string[][] {
  const text = input.replace(/^﻿/, '');
  const d = delimiter || detectDelimiter(text);
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { cell += '"'; i++; } else inQuotes = false;
      } else cell += ch;
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === d) {
      row.push(cell); cell = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(cell); cell = '';
      rows.push(row); row = [];
    } else cell += ch;
  }
  if (cell !== '' || row.length > 0) { row.push(cell); rows.push(row); }
  return rows.filter(r => r.some(c => c.trim() !== ''));
}

export interface ColumnDef {
  key: string;
  label: string;
  required?: boolean;
  /** Header names (lower-case) that map to this column, e.g. ['mobile', 'phone', 'tel']. */
  aliases: string[];
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9؀-ۿ]+/g, ' ').trim();

/** Maps a header row to column keys. Returns the index of each column (or -1) so the UI can show what was recognised. */
export function mapHeaders(header: string[], columns: ColumnDef[]): Record<string, number> {
  const normalized = header.map(norm);
  const result: Record<string, number> = {};
  for (const col of columns) {
    const names = [col.key, col.label, ...col.aliases].map(norm);
    result[col.key] = normalized.findIndex(h => names.includes(h));
  }
  return result;
}

/** Turns CSV rows (header first) into objects keyed by column key. */
export function rowsToObjects(rows: string[][], columns: ColumnDef[]): { records: Array<Record<string, string>>; mapping: Record<string, number>; missingRequired: string[] } {
  if (rows.length === 0) return { records: [], mapping: {}, missingRequired: columns.filter(c => c.required).map(c => c.key) };
  const mapping = mapHeaders(rows[0], columns);
  const missingRequired = columns.filter(c => c.required && mapping[c.key] === -1).map(c => c.key);
  const records = rows.slice(1).map(r => {
    const rec: Record<string, string> = {};
    for (const col of columns) rec[col.key] = mapping[col.key] >= 0 ? (r[mapping[col.key]] ?? '').trim() : '';
    return rec;
  });
  return { records, mapping, missingRequired };
}

/** Builds CSV text (used for the downloadable templates). Cells with commas, quotes or newlines are quoted. */
export function toCsv(rows: string[][]): string {
  const esc = (c: string) => (/[",\n\r;]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c);
  return rows.map(r => r.map(esc).join(',')).join('\r\n');
}
