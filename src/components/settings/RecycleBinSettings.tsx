import React, { useEffect, useRef, useState } from 'react';
import { Trash2, ChevronDown } from 'lucide-react';
import { Link } from 'react-router-dom';
import { toast } from '../../lib/notify';
import { RECYCLE_BIN_DAY_OPTIONS, parseRecycleBinDays, describeRecycleBinDays } from '../../lib/recycleBin';

/**
 * "Recycle Bin Auto-Clear" (setting `recycleBinDays`). Restored from the earlier Settings page: deleted quotes stay in
 * the Recycle Bin for the chosen number of days (pinned ones forever), 0 = never clear automatically.
 */
export default function RecycleBinSettings() {
  const [days, setDays] = useState<number>(30);
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/settings/recycleBinDays')
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (!cancelled) setDays(parseRecycleBinDays(d?.value)); })
      .catch(() => { /* keep the default */ });
    return () => { cancelled = true; if (timer.current) clearTimeout(timer.current); };
  }, []);

  const save = async (next: number) => {
    const previous = days;
    setDays(next);
    setStatus('loading');
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'recycleBinDays', value: String(next) }),
      });
      if (!res.ok) throw new Error('save failed');
      setStatus('success');
    } catch {
      setDays(previous);
      setStatus('error');
      toast('Could not save the Recycle Bin setting.', 'error');
    }
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setStatus('idle'), 2500);
  };

  // A value saved by hand (e.g. 45) still shows up as a choice.
  const options = RECYCLE_BIN_DAY_OPTIONS.some(o => o.value === days)
    ? RECYCLE_BIN_DAY_OPTIONS
    : [...RECYCLE_BIN_DAY_OPTIONS, { value: days, label: `${days} days` }];

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <div className="p-6 border-b border-gray-200 bg-gray-50 flex items-center gap-3">
        <Trash2 className="text-red-600" size={24} />
        <div>
          <h2 className="text-xl font-semibold text-gray-800">Recycle Bin</h2>
          <p className="text-sm text-gray-500 mt-0.5">How long deleted quotations are kept before they are removed for good. Pinned quotes are never removed automatically.</p>
        </div>
      </div>
      <div className="p-6 flex flex-col sm:flex-row sm:items-center gap-3">
        <label htmlFor="recycle-bin-days" className="text-sm font-medium text-gray-700">Recycle Bin Auto-Clear</label>
        <div className="relative">
          <select
            id="recycle-bin-days"
            value={days}
            disabled={status === 'loading'}
            onChange={e => save(parseInt(e.target.value, 10))}
            className="appearance-none pl-3 pr-8 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-indigo-500 outline-none disabled:opacity-60"
          >
            {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <ChevronDown size={14} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
        </div>
        <span className="text-sm text-gray-500" aria-live="polite">
          {status === 'loading' && 'Saving…'}
          {status === 'success' && <span className="text-emerald-600 font-medium">Saved ✓</span>}
          {status === 'error' && <span className="text-red-600 font-medium">Save failed</span>}
          {status === 'idle' && describeRecycleBinDays(days)}
        </span>
        <Link to="/recycle-bin" className="sm:ml-auto text-sm font-medium text-indigo-600 hover:underline">Open Recycle Bin →</Link>
      </div>
    </div>
  );
}
