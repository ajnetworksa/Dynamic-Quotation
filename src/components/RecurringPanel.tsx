import React, { useCallback, useEffect, useState } from 'react';
import { Repeat, Ban, Loader2 } from 'lucide-react';
import { toast, confirmAsync } from '../lib/notify';

interface Schedule { id: number; frequency: string; next_run: string; end_date: string | null; active: number; runs: number; last_created_id: string | null; created_by: string | null }

const LABELS: Record<string, string> = { weekly: 'Every week', monthly: 'Every month', quarterly: 'Every 3 months', yearly: 'Every year' };

/** Repeat a document automatically: a new Draft copy is created on every due date (e.g. monthly service invoices). */
export default function RecurringPanel({ quoteId, onChanged }: { quoteId: string; onChanged?: () => void }) {
  const [rows, setRows] = useState<Schedule[] | null>(null);
  const [frequency, setFrequency] = useState('monthly');
  const [start, setStart] = useState(() => new Date().toISOString().slice(0, 10));
  const [end, setEnd] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/quotes/${encodeURIComponent(quoteId)}/recurring`);
      setRows(res.ok ? await res.json() : []);
    } catch { setRows([]); }
  }, [quoteId]);
  useEffect(() => { setRows(null); load(); }, [load]);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await fetch(`/api/quotes/${encodeURIComponent(quoteId)}/recurring`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ frequency, start_date: start, end_date: end || null }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) { toast(body.error || body.details?.join('; ') || 'Could not create the schedule.', 'error'); return; }
      toast(body.createdNow ? `Schedule created. ${body.createdNow} draft(s) generated now.` : 'Schedule created.', 'success');
      load(); onChanged?.();
    } finally { setBusy(false); }
  };

  const stop = async (id: number) => {
    if (!await confirmAsync('Stop this schedule? Documents already created are kept.', { danger: true, confirmLabel: 'Stop' })) return;
    const res = await fetch(`/api/recurring/${id}`, { method: 'DELETE' });
    if (res.ok) { load(); } else toast('Could not stop the schedule.', 'error');
  };

  const active = (rows || []).filter(r => r.active);
  return (
    <section aria-labelledby="rec-title" className="px-6 py-4 border-b border-gray-200">
      <h4 id="rec-title" className="text-sm font-bold text-gray-800 flex items-center gap-2 mb-2"><Repeat size={16} className="text-purple-600" /> Repeat this document</h4>
      {rows === null && <Loader2 className="animate-spin text-indigo-600" size={14} />}
      {active.map(r => (
        <div key={r.id} className="flex items-start justify-between gap-2 bg-purple-50 border border-purple-100 rounded p-2 mb-2 text-xs">
          <div>
            <div className="font-semibold text-purple-800">{LABELS[r.frequency] || r.frequency}</div>
            <div className="text-gray-600">Next draft on {r.next_run}{r.end_date ? ` · until ${r.end_date}` : ''}</div>
            <div className="text-gray-400">{r.runs} created{r.last_created_id ? `, last ${r.last_created_id}` : ''}</div>
          </div>
          <button onClick={() => stop(r.id)} aria-label="Stop schedule" className="p-1 text-red-500 hover:bg-red-50 rounded shrink-0"><Ban size={14} /></button>
        </div>
      ))}
      {rows !== null && active.length === 0 && (
        <form onSubmit={create} className="grid grid-cols-2 gap-2 text-xs">
          <select aria-label="How often" value={frequency} onChange={e => setFrequency(e.target.value)} className="border border-gray-300 rounded px-2 py-1.5 bg-white col-span-2">
            {Object.entries(LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <label className="text-gray-500">First copy<input type="date" value={start} onChange={e => setStart(e.target.value)} required className="mt-0.5 w-full border border-gray-300 rounded px-2 py-1.5 text-gray-900" /></label>
          <label className="text-gray-500">Stop after (optional)<input type="date" value={end} onChange={e => setEnd(e.target.value)} className="mt-0.5 w-full border border-gray-300 rounded px-2 py-1.5 text-gray-900" /></label>
          <button type="submit" disabled={busy} className="col-span-2 inline-flex items-center justify-center gap-1 bg-purple-600 text-white rounded py-1.5 font-semibold hover:bg-purple-700 disabled:opacity-50"><Repeat size={14} /> Start repeating</button>
          <p className="col-span-2 text-[10px] text-gray-400">Each copy is a new Draft with today's date and the same items and prices. Payments and notes are not copied.</p>
        </form>
      )}
    </section>
  );
}
