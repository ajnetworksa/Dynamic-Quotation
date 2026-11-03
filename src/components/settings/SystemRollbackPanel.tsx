import React, { useEffect, useState } from 'react';
import { RotateCcw, Loader2, AlertTriangle } from 'lucide-react';
import { toast, confirmAsync } from '../../lib/notify';

type UpdateRecord = { from: string; to: string; at: string; by: string; dbBackup: string; rolledBackAt?: string; rolledBackBy?: string; restoredDatabase?: boolean };
type Info = { enabled: boolean; current: string; last: UpdateRecord | null; canRollback: boolean; dbBackupExists: boolean; history: UpdateRecord[] };

/**
 * Settings → System → "Roll back last update" (admins only).
 * Puts back the code version that was running before the last "Update Now". The database is only
 * replaced when the admin ticks the box (everything entered after the update would be lost).
 */
export default function SystemRollbackPanel() {
  const [info, setInfo] = useState<Info | null>(null);
  const [withDb, setWithDb] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = () => fetch('/api/system/rollback-info').then(r => (r.ok ? r.json() : null)).then(setInfo).catch(() => setInfo(null));
  useEffect(() => { load(); }, []);

  const rollback = async () => {
    if (!info?.last) return;
    const msg = withDb
      ? `Roll back to the version from before ${new Date(info.last.at).toLocaleString()} AND restore the database copy from that moment?\n\nEverything entered after the update (quotes, customers…) will be LOST. A safety copy of the current database is kept in backups/.`
      : `Roll back the program to the version from before ${new Date(info.last.at).toLocaleString()}?\n\nYour data is kept. The server restarts and everyone has to reload the page.`;
    if (!await confirmAsync(msg)) return;
    setBusy(true);
    try {
      const res = await fetch('/api/system/rollback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ restoreDatabase: withDb }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { toast(d.error || 'Rollback failed.', 'error'); setBusy(false); return; }
      toast(d.message || 'Rolled back. The server is restarting…', 'success');
      setTimeout(() => window.location.reload(), 6000);
    } catch (e: any) {
      toast('Rollback failed: ' + (e?.message || e), 'error');
      setBusy(false);
    }
  };

  if (!info) return null;
  const short = (h: string) => (h || '').slice(0, 7);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <div className="p-6 border-b border-gray-200 bg-gray-50 flex items-center gap-3">
        <RotateCcw className="text-amber-600" size={24} />
        <div>
          <h2 className="text-xl font-semibold text-gray-800">Roll Back Last Update</h2>
          <p className="text-sm text-gray-500 mt-0.5">If something is wrong after "Update Now", go back to the version that was running before.</p>
        </div>
      </div>
      <div className="p-6 space-y-4">
        {!info.last ? (
          <p className="text-sm text-gray-500">No update has been installed from here yet, so there is nothing to roll back.</p>
        ) : (
          <>
            <div className="text-sm text-gray-700">
              Last update: <b>{new Date(info.last.at).toLocaleString()}</b> by {info.last.by} —
              <span className="font-mono text-xs ml-1">{short(info.last.from)} → {short(info.last.to)}</span>
            </div>
            {!info.enabled && (
              <p className="text-sm text-amber-700 flex items-start gap-2"><AlertTriangle size={16} className="shrink-0 mt-0.5" />Rollback uses the same mechanism as self-update: set ALLOW_SELF_UPDATE=true in .env.</p>
            )}
            {info.enabled && !info.canRollback && (
              <p className="text-sm text-amber-700 flex items-start gap-2"><AlertTriangle size={16} className="shrink-0 mt-0.5" />The program was changed after that update (current {short(info.current)}), so it cannot be rolled back automatically.</p>
            )}
            <label className="flex items-start gap-2 text-sm text-gray-700">
              <input type="checkbox" className="mt-0.5 accent-red-600" checked={withDb} disabled={!info.dbBackupExists} onChange={e => setWithDb(e.target.checked)} />
              <span>Also restore the database copy taken just before the update <span className="text-red-600">(data entered after the update is lost)</span>{!info.dbBackupExists && ' — copy not found'}</span>
            </label>
            <button
              type="button"
              onClick={rollback}
              disabled={busy || !info.enabled || !info.canRollback}
              className="flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors disabled:opacity-50"
            >
              {busy ? <Loader2 size={18} className="animate-spin" /> : <RotateCcw size={18} />} Roll back now
            </button>
          </>
        )}
        {info.history.some(h => h.rolledBackAt) && (
          <div className="text-xs text-gray-500 border-t border-gray-100 pt-3 space-y-1">
            {info.history.filter(h => h.rolledBackAt).slice(0, 5).map(h => (
              <div key={h.at}>Rolled back {new Date(h.rolledBackAt!).toLocaleString()} by {h.rolledBackBy}: {short(h.to)} → {short(h.from)}{h.restoredDatabase ? ' (with database)' : ''}</div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
