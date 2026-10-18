import React, { useEffect, useState } from 'react';
import { ClipboardList, Search, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';

interface AuditRow {
  id: number;
  ts: string;
  actor: string | null;
  ip: string | null;
  action: string;
  target: string | null;
  details: string | null;
  status: number | null;
}

const LIMIT = 50;

/** Who did what and when: logins, user/permission changes, exports, restores, deletes ... (admin or "Audit Log" permission). */
export default function AuditLog() {
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [actors, setActors] = useState<string[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  const [actor, setActor] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      setError('');
      try {
        const params = new URLSearchParams({ page: String(page), limit: String(LIMIT) });
        if (q.trim()) params.set('q', q.trim());
        if (actor) params.set('actor', actor);
        if (from) params.set('from', from);
        if (to) params.set('to', to);
        const res = await fetch(`/api/audit-log?${params}`, { signal: controller.signal });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          setError(body.error || 'Could not load the audit log.');
          return;
        }
        const data = await res.json();
        setRows(data.items || []);
        setTotal(data.total || 0);
        setActors(data.actors || []);
      } catch (e: any) {
        if (e?.name !== 'AbortError') setError('Network error while loading the audit log.');
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 250); // debounce typing
    return () => { clearTimeout(timer); controller.abort(); };
  }, [page, q, actor, from, to]);

  const pages = Math.max(1, Math.ceil(total / LIMIT));
  const resetPage = () => setPage(1);

  return (
    <div className="max-w-7xl mx-auto space-y-4">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <ClipboardList className="text-indigo-600" size={24} />
          <div>
            <h2 className="text-xl font-semibold text-gray-800">Audit Log</h2>
            <p className="text-sm text-gray-500">Logins, user and permission changes, exports, restores and deletions. Kept for one year.</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-3 items-end">
          <div className="relative flex-1 min-w-[200px]">
            <label htmlFor="audit-q" className="sr-only">Search</label>
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" aria-hidden="true" />
            <input id="audit-q" value={q} onChange={e => { setQ(e.target.value); resetPage(); }} placeholder="Search user, action, target or IP"
              className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" />
          </div>
          <div>
            <label htmlFor="audit-actor" className="block text-xs font-medium text-gray-500 mb-1">User</label>
            <select id="audit-actor" value={actor} onChange={e => { setActor(e.target.value); resetPage(); }} className="border border-gray-300 rounded-lg px-3 py-2 bg-white">
              <option value="">All users</option>
              {actors.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="audit-from" className="block text-xs font-medium text-gray-500 mb-1">From</label>
            <input id="audit-from" type="date" value={from} onChange={e => { setFrom(e.target.value); resetPage(); }} className="border border-gray-300 rounded-lg px-3 py-2" />
          </div>
          <div>
            <label htmlFor="audit-to" className="block text-xs font-medium text-gray-500 mb-1">To</label>
            <input id="audit-to" type="date" value={to} onChange={e => { setTo(e.target.value); resetPage(); }} className="border border-gray-300 rounded-lg px-3 py-2" />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-x-auto">
        {error && <div role="alert" className="p-4 text-red-700 bg-red-50 border-b border-red-200">{error}</div>}
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-100 text-gray-600 uppercase text-xs tracking-wider">
            <tr>
              <th className="p-3">When</th>
              <th className="p-3">User</th>
              <th className="p-3">Action</th>
              <th className="p-3">Target</th>
              <th className="p-3">IP</th>
              <th className="p-3">Result</th>
            </tr>
          </thead>
          <tbody>
            {loading && rows.length === 0 && (
              <tr><td colSpan={6} className="p-8 text-center text-gray-400"><Loader2 className="inline animate-spin mr-2" size={16} />Loading…</td></tr>
            )}
            {!loading && rows.length === 0 && !error && (
              <tr><td colSpan={6} className="p-8 text-center text-gray-400">No entries match.</td></tr>
            )}
            {rows.map(r => (
              <tr key={r.id} className="border-t border-gray-100 hover:bg-gray-50">
                <td className="p-3 whitespace-nowrap text-gray-600">{new Date(r.ts).toLocaleString()}</td>
                <td className="p-3 font-medium text-gray-800">{r.actor || '—'}</td>
                <td className="p-3 font-mono text-xs text-gray-700">{r.action}</td>
                <td className="p-3 text-gray-600 break-all">{r.target || ''}</td>
                <td className="p-3 text-gray-500 font-mono text-xs">{r.ip || ''}</td>
                <td className="p-3">
                  <span className={`px-2 py-0.5 rounded text-xs font-bold ${r.status && r.status >= 400 ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}`}>{r.status ?? ''}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="flex items-center justify-between p-3 border-t border-gray-200 text-sm text-gray-600">
          <span>{total} entr{total === 1 ? 'y' : 'ies'}</span>
          <div className="flex items-center gap-2">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1} aria-label="Previous page" className="p-1.5 rounded border border-gray-300 disabled:opacity-40"><ChevronLeft size={16} /></button>
            <span>Page {page} of {pages}</span>
            <button onClick={() => setPage(p => Math.min(pages, p + 1))} disabled={page >= pages} aria-label="Next page" className="p-1.5 rounded border border-gray-300 disabled:opacity-40"><ChevronRight size={16} /></button>
          </div>
        </div>
      </div>
    </div>
  );
}
