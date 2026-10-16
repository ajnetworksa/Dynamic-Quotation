import React, { useMemo, useRef, useState } from 'react';
import { X, Upload, Download, Loader2, FileSpreadsheet } from 'lucide-react';
import { parseCsv, rowsToObjects, toCsv, ColumnDef } from '../lib/csv';
import { classify } from '../lib/importDedupe';
import { toast } from '../lib/notify';

export interface CsvImportProps {
  title: string;
  columns: ColumnDef[];
  /** Example rows (header is added automatically) for the downloadable template. */
  sample: string[][];
  templateName: string;
  /** Keys of records already in the database, for the duplicate preview. */
  existingKeys: Set<string>;
  keysOf: (record: Record<string, string>) => string[];
  /** Extra per-record validation; return an error string to exclude the row. */
  validate?: (record: Record<string, string>) => string | null;
  /** Converts a record to the JSON payload sent to the server. */
  toPayload: (record: Record<string, string>) => any;
  endpoint: string;
  /** Extra controls (e.g. what to do with duplicates) merged into the request body. */
  duplicateOptions?: { label: string; options: Array<{ value: string; label: string }>; field: string; default: string };
  onDone: () => void;
  onClose: () => void;
}

const BADGE: Record<string, string> = {
  new: 'bg-green-100 text-green-800',
  duplicate: 'bg-amber-100 text-amber-800',
  repeat: 'bg-amber-100 text-amber-800',
  invalid: 'bg-red-100 text-red-800',
};

export default function CsvImportModal(p: CsvImportProps) {
  const [fileName, setFileName] = useState('');
  const [rows, setRows] = useState<string[][]>([]);
  const [dupMode, setDupMode] = useState(p.duplicateOptions?.default || 'skip');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const parsed = useMemo(() => rowsToObjects(rows, p.columns), [rows, p.columns]);
  const states = useMemo(() => {
    const kinds = classify(parsed.records, p.keysOf, p.existingKeys);
    return parsed.records.map((rec, i) => {
      const invalid = p.validate?.(rec) || (p.columns.some(c => c.required && !rec[c.key]) ? 'Missing required value' : null);
      return invalid ? { kind: 'invalid' as const, note: invalid } : { kind: kinds[i], note: '' };
    });
  }, [parsed, p]);

  const counts = states.reduce((a, s) => { a[s.kind] = (a[s.kind] || 0) + 1; return a; }, {} as Record<string, number>);
  const importable = parsed.records.filter((_, i) => states[i].kind === 'new' || (states[i].kind !== 'invalid' && !!p.duplicateOptions && dupMode === 'update'));

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setError('');
    if (file.size > 5 * 1024 * 1024) { setError('File is larger than 5 MB.'); return; }
    const text = await file.text();
    const r = parseCsv(text);
    if (r.length < 2) { setError('The file has no data rows.'); return; }
    setFileName(file.name);
    setRows(r);
  };

  const downloadTemplate = () => {
    const header = p.columns.map(c => c.label);
    const blob = new Blob(['﻿' + toCsv([header, ...p.sample])], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = p.templateName;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  };

  const submit = async () => {
    setBusy(true); setError('');
    try {
      const body: any = { rows: importable.map(p.toPayload) };
      if (p.duplicateOptions) body[p.duplicateOptions.field] = dupMode;
      else body.skipDuplicates = true;
      const res = await fetch(p.endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setError(data.details?.join('; ') || data.error || 'Import failed. Nothing was imported.'); return; }
      const parts = [`${data.created ?? 0} added`];
      if (data.updated) parts.push(`${data.updated} updated`);
      if (data.skipped) parts.push(`${data.skipped} skipped as duplicates`);
      toast(`Import complete: ${parts.join(', ')}.`, 'success');
      p.onDone();
      p.onClose();
    } catch { setError('Network error. Nothing was imported.'); } finally { setBusy(false); }
  };

  return (
    <div role="dialog" aria-modal="true" aria-label={p.title} className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={p.onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-gray-200 shrink-0">
          <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2"><FileSpreadsheet className="text-indigo-600" size={20} /> {p.title}</h2>
          <button onClick={p.onClose} aria-label="Close" className="p-1 text-gray-400 hover:text-gray-600 rounded"><X size={20} /></button>
        </div>

        <div className="p-5 overflow-y-auto space-y-4">
          <div className="flex flex-wrap gap-3 items-center">
            <input ref={fileRef} type="file" accept=".csv,.txt,text/csv" className="sr-only" id="csv-file" onChange={e => onFile(e.target.files?.[0])} />
            <label htmlFor="csv-file" className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700">
              <Upload size={16} /> Choose CSV file
            </label>
            <button onClick={downloadTemplate} className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"><Download size={16} /> Download template</button>
            {fileName && <span className="text-sm text-gray-500">{fileName}</span>}
          </div>
          <p className="text-xs text-gray-500">
            Columns recognised: {p.columns.map(c => c.label + (c.required ? ' *' : '')).join(', ')}. Column order does not matter; the first row must be the header. Excel: Save As, CSV UTF-8.
          </p>
          {error && <div role="alert" className="bg-red-50 text-red-700 text-sm p-3 rounded-lg">{error}</div>}

          {rows.length > 0 && (
            <>
              {parsed.missingRequired.length > 0 && (
                <div role="alert" className="bg-red-50 text-red-700 text-sm p-3 rounded-lg">
                  Required column(s) not found: {parsed.missingRequired.join(', ')}. Check the header row or use the template.
                </div>
              )}
              <div className="flex flex-wrap gap-4 text-sm">
                <span><b>{parsed.records.length}</b> rows</span>
                <span className="text-green-700"><b>{counts.new || 0}</b> new</span>
                <span className="text-amber-700"><b>{(counts.duplicate || 0) + (counts.repeat || 0)}</b> duplicates</span>
                <span className="text-red-700"><b>{counts.invalid || 0}</b> invalid</span>
                {p.duplicateOptions && (
                  <label className="flex items-center gap-2 ml-auto">
                    {p.duplicateOptions.label}
                    <select value={dupMode} onChange={e => setDupMode(e.target.value)} className="border border-gray-300 rounded px-2 py-1 bg-white">
                      {p.duplicateOptions.options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </label>
                )}
              </div>
              <div className="border border-gray-200 rounded-lg overflow-auto max-h-[40vh]">
                <table className="w-full text-sm text-left">
                  <thead className="bg-gray-100 text-gray-600 sticky top-0">
                    <tr>
                      <th className="p-2 w-24">Status</th>
                      {p.columns.map(c => <th key={c.key} className="p-2">{c.label}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {parsed.records.slice(0, 200).map((rec, i) => (
                      <tr key={i} className="border-t border-gray-100">
                        <td className="p-2"><span title={states[i].note} className={`px-2 py-0.5 rounded text-xs font-bold ${BADGE[states[i].kind]}`}>{states[i].kind}</span></td>
                        {p.columns.map(c => <td key={c.key} className="p-2 max-w-[220px] truncate" title={rec[c.key]}>{rec[c.key]}</td>)}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {parsed.records.length > 200 && <p className="text-xs text-gray-400">Showing the first 200 rows; all rows are imported.</p>}
            </>
          )}
        </div>

        <div className="flex justify-end gap-3 p-4 border-t border-gray-200 shrink-0">
          <button onClick={p.onClose} className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50">Cancel</button>
          <button onClick={submit} disabled={busy || importable.length === 0 || parsed.missingRequired.length > 0}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 disabled:opacity-50 inline-flex items-center gap-2">
            {busy && <Loader2 className="animate-spin" size={16} />} Import {importable.length} row{importable.length === 1 ? '' : 's'}
          </button>
        </div>
      </div>
    </div>
  );
}
