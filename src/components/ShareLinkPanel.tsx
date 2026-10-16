import React, { useCallback, useEffect, useState } from 'react';
import { Link2, Copy, Ban, Loader2 } from 'lucide-react';
import { toast, confirmAsync } from '../lib/notify';

interface ShareRow {
  id: number; created_by: string | null; created_at: string; expires_at: string; revoked: number;
  first_viewed_at: string | null; last_viewed_at: string | null; view_count: number;
  decision: string | null; responded_at: string | null; signer_name: string | null; decision_reason: string | null;
}

const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleString() : '');

/** Create / revoke public approval links for a quote and see whether the client viewed or answered. */
export default function ShareLinkPanel({ quoteId, onChanged }: { quoteId: string; onChanged?: () => void }) {
  const [rows, setRows] = useState<ShareRow[] | null>(null);
  const [days, setDays] = useState(30);
  const [busy, setBusy] = useState(false);
  const [fresh, setFresh] = useState('');

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/quotes/${encodeURIComponent(quoteId)}/share-links`);
      setRows(res.ok ? await res.json() : []);
    } catch { setRows([]); }
  }, [quoteId]);
  useEffect(() => { setRows(null); setFresh(''); load(); }, [load]);

  const copy = async (text: string) => {
    try { await navigator.clipboard.writeText(text); toast('Link copied.', 'success'); }
    catch { toast('Copy failed. Select the link and copy it manually.', 'error'); }
  };

  const create = async () => {
    setBusy(true);
    try {
      const res = await fetch(`/api/quotes/${encodeURIComponent(quoteId)}/share-link`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ days }) });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) { toast(body.error || 'Could not create the link.', 'error'); return; }
      setFresh(body.url);
      copy(body.url);
      load();
    } finally { setBusy(false); }
  };

  const revoke = async (id: number) => {
    if (!await confirmAsync('Withdraw this link? The client will no longer be able to open it.', { danger: true, confirmLabel: 'Withdraw' })) return;
    const res = await fetch(`/api/share-links/${id}`, { method: 'DELETE' });
    if (res.ok) { load(); onChanged?.(); } else toast('Could not withdraw the link.', 'error');
  };

  const now = Date.now();
  return (
    <section aria-labelledby="share-title" className="px-6 py-4 border-b border-gray-200">
      <h4 id="share-title" className="text-sm font-bold text-gray-800 flex items-center gap-2 mb-2"><Link2 size={16} className="text-indigo-600" /> Client approval link</h4>
      <p className="text-xs text-gray-500 mb-2">Send the client a private link to review this document, download the PDF and accept or decline online. No login needed.</p>
      <div className="flex items-center gap-2 mb-2">
        <label htmlFor="share-days" className="text-xs text-gray-600">Valid for</label>
        <select id="share-days" value={days} onChange={e => setDays(Number(e.target.value))} className="border border-gray-300 rounded px-2 py-1 text-xs bg-white">
          {[7, 14, 30, 60, 90].map(d => <option key={d} value={d}>{d} days</option>)}
        </select>
        <button onClick={create} disabled={busy} className="ml-auto inline-flex items-center gap-1 px-3 py-1.5 bg-indigo-600 text-white text-xs rounded font-semibold hover:bg-indigo-700 disabled:opacity-50">
          {busy ? <Loader2 className="animate-spin" size={12} /> : <Link2 size={12} />} Create link
        </button>
      </div>
      {fresh && (
        <div className="flex items-center gap-2 bg-indigo-50 border border-indigo-100 rounded p-2 mb-2">
          <input readOnly aria-label="New approval link" value={fresh} onFocus={e => e.currentTarget.select()} className="flex-1 min-w-0 text-xs bg-transparent outline-none font-mono" />
          <button onClick={() => copy(fresh)} aria-label="Copy link" className="p-1 text-indigo-700 hover:bg-indigo-100 rounded"><Copy size={14} /></button>
        </div>
      )}
      {fresh && <p className="text-[10px] text-gray-400 mb-2">This is the only time the full link is shown. Copy it now.</p>}
      {rows === null ? <Loader2 className="animate-spin text-indigo-600" size={14} /> : rows.length === 0 ? null : (
        <ul className="divide-y divide-gray-100 border border-gray-200 rounded text-xs">
          {rows.map(r => {
            const expired = new Date(r.expires_at).getTime() < now;
            const state = r.revoked ? 'Withdrawn' : r.decision ? (r.decision === 'accepted' ? 'Accepted' : 'Declined') : expired ? 'Expired' : r.view_count > 0 ? 'Viewed' : 'Sent, not opened';
            return (
              <li key={r.id} className="p-2 flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <span className={`font-semibold ${r.decision === 'accepted' ? 'text-emerald-700' : r.decision === 'rejected' ? 'text-gray-700' : r.revoked || expired ? 'text-gray-400' : 'text-indigo-700'}`}>{state}</span>
                  <span className="text-gray-500"> · created {fmt(r.created_at)}{r.created_by ? ` by ${r.created_by}` : ''}</span>
                  {r.view_count > 0 && <div className="text-gray-400">Opened {r.view_count}×, last {fmt(r.last_viewed_at)}</div>}
                  {r.decision && <div className="text-gray-600">By {r.signer_name} on {fmt(r.responded_at)}{r.decision_reason ? ` — “${r.decision_reason}”` : ''}</div>}
                  {!r.revoked && !r.decision && !expired && <div className="text-gray-400">Expires {fmt(r.expires_at)}</div>}
                </div>
                {!r.revoked && !r.decision && !expired && <button onClick={() => revoke(r.id)} aria-label="Withdraw link" className="p-1 text-red-500 hover:bg-red-50 rounded shrink-0"><Ban size={14} /></button>}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
