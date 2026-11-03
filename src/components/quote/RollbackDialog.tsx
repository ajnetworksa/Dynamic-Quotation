import React, { useEffect, useState } from 'react';
import { RotateCcw, X, Loader2 } from 'lucide-react';
import { toast, confirmAsync } from '../../lib/notify';

interface Props {
  quoteId: string;
  onClose: () => void;
  /** called after a successful rollback (the editor reloads the quote) */
  onRolledBack: () => void;
}

type LogRow = { id: number; action: string; actor: string | null; timestamp: string; previous_state?: string | null };

/**
 * "Roll back" in the quote editor (admins / users with "Undo Timeline Actions").
 * Every save keeps a copy of the quote as it was before; picking one puts the quote back to that version.
 * The current version is kept too, so a rollback can itself be rolled back.
 */
export default function RollbackDialog({ quoteId, onClose, onRolledBack }: Props) {
  const [rows, setRows] = useState<{ log: LogRow; version: number | null; total: number | null; items: number }[] | null>(null);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState<number | null>(null);

  useEffect(() => {
    let alive = true;
    fetch(`/api/quotes/${encodeURIComponent(quoteId)}/timeline`)
      .then(async r => { const d = await r.json().catch(() => ({})); if (!r.ok) throw new Error(d.error || `HTTP ${r.status}`); return d; })
      .then(d => {
        if (!alive) return;
        const logs: LogRow[] = Array.isArray(d.logs) ? d.logs : [];
        const list = logs.filter(l => l.previous_state).reverse().map(log => {
          try {
            const p = JSON.parse(log.previous_state as string);
            return { log, version: p?.quote?.version ?? null, total: p?.quote?.grand_total ?? null, items: Array.isArray(p?.items) ? p.items.length : 0 };
          } catch { return { log, version: null, total: null, items: 0 }; }
        });
        setRows(list);
      })
      .catch(e => { if (alive) setError(e.message || 'Could not load the history.'); });
    return () => { alive = false; };
  }, [quoteId]);

  const restore = async (row: { log: LogRow; version: number | null }) => {
    if (!await confirmAsync(`Roll ${quoteId} back to version ${row.version ?? '?'} (as it was before the change on ${new Date(row.log.timestamp).toLocaleString()})?\n\nThe current version is kept in the history, so you can roll forward again.`)) return;
    setBusyId(row.log.id);
    try {
      const res = await fetch(`/api/quotes/${encodeURIComponent(quoteId)}/undo/${row.log.id}`, { method: 'POST' });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { toast(d.error || 'Rollback failed.', 'error'); setBusyId(null); return; }
      toast(`${quoteId} rolled back to version ${row.version ?? '?'}.`, 'success');
      onRolledBack();
    } catch (e: any) {
      toast('Rollback failed: ' + (e?.message || e), 'error');
      setBusyId(null);
    }
  };

  return (
    <div role="dialog" aria-modal="true" aria-label={`Roll back ${quoteId}`} className="fixed inset-0 z-[10000] flex items-center justify-center p-4 print:hidden" style={{ backgroundColor: 'rgba(0,0,0,0.45)' }} onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-xl w-full max-h-[80vh] flex flex-col border border-gray-100 dark:border-gray-700">
        <div className="flex items-start gap-3 p-5 border-b border-gray-100 dark:border-gray-700">
          <div className="p-2.5 bg-amber-50 dark:bg-amber-900/30 text-amber-600 rounded-xl shrink-0"><RotateCcw size={20} /></div>
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">Roll back {quoteId}</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Pick the version to go back to. Newest first.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500"><X size={18} /></button>
        </div>
        <div className="overflow-y-auto p-5 space-y-2">
          {error && <p className="text-sm text-red-600">{error}</p>}
          {!rows && !error && <p className="text-sm text-gray-500 flex items-center gap-2"><Loader2 size={16} className="animate-spin" /> Loading history…</p>}
          {rows && rows.length === 0 && <p className="text-sm text-gray-500">No earlier saved versions of this quote yet.</p>}
          {rows?.map(r => (
            <div key={r.log.id} className="flex items-center gap-3 p-3 rounded-xl border border-gray-200 dark:border-gray-700">
              <div className="flex-1 min-w-0 text-sm">
                <div className="font-semibold text-gray-800 dark:text-gray-100">Version {r.version ?? '?'}{r.total !== null && <span className="font-normal text-gray-500"> · total {Number(r.total).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} · {r.items} line{r.items === 1 ? '' : 's'}</span>}</div>
                <div className="text-xs text-gray-500 truncate">before “{r.log.action}” by {r.log.actor || 'system'} · {new Date(r.log.timestamp).toLocaleString()}</div>
              </div>
              <button type="button" disabled={busyId !== null} onClick={() => restore(r)} className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold rounded-lg bg-amber-600 hover:bg-amber-700 text-white disabled:opacity-50">
                {busyId === r.log.id ? <Loader2 size={14} className="animate-spin" /> : <RotateCcw size={14} />} Restore
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
