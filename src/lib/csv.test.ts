import { describe, it, expect } from 'vitest';
import { parseCsv, detectDelimiter, rowsToObjects, toCsv, ColumnDef } from './csv';

const COLS: ColumnDef[] = [
  { key: 'name', label: 'Name', required: true, aliases: ['company', 'customer'] },
  { key: 'mobile', label: 'Mobile', aliases: ['phone', 'tel'] },
];

describe('csv', () => {
  it('parses quotes, escaped quotes, embedded newlines and a BOM', () => {
    const rows = parseCsv('﻿Name,Note\r\n"Smith, John","He said ""hi"""\r\n"Multi\nline",x\r\n');
    expect(rows).toEqual([['Name', 'Note'], ['Smith, John', 'He said "hi"'], ['Multi\nline', 'x']]);
  });
  it('detects semicolon and tab delimiters', () => {
    expect(detectDelimiter('a;b;c')).toBe(';');
    expect(detectDelimiter('a\tb\tc')).toBe('\t');
    expect(detectDelimiter('"a;b",c')).toBe(',');
  });
  it('skips blank lines', () => {
    expect(parseCsv('a,b\n\n1,2\n,\n')).toEqual([['a', 'b'], ['1', '2']]);
  });
  it('maps headers through aliases and reports missing required columns', () => {
    const ok = rowsToObjects(parseCsv('Company,Phone\nAcme,0501'), COLS);
    expect(ok.records).toEqual([{ name: 'Acme', mobile: '0501' }]);
    expect(ok.missingRequired).toEqual([]);
    const bad = rowsToObjects(parseCsv('Phone\n0501'), COLS);
    expect(bad.missingRequired).toEqual(['name']);
  });
  it('round-trips through toCsv', () => {
    const rows = [['a', 'b,c'], ['"q"', 'x\ny']];
    expect(parseCsv(toCsv(rows))).toEqual(rows);
  });
});
