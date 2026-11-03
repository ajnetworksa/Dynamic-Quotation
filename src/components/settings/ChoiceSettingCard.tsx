import React, { useEffect, useRef, useState } from 'react';
import { toast } from '../../lib/notify';

export interface ChoiceOption<T extends string> { value: T; title: string; description: string }

interface Props<T extends string> {
  /** Settings key stored on the server (GET /api/settings/:key, POST /api/settings). */
  settingKey: string;
  title: React.ReactNode;
  subtitle: string;
  icon: React.ReactNode;
  options: Array<ChoiceOption<T>>;
  defaultValue: T;
  /** Optional hook, e.g. to mirror the value into localStorage. */
  onChange?: (value: T) => void;
}

/**
 * A "pick one of N" settings card that loads and saves one setting key by itself. Replaces three copies of the same
 * ~60-line block (row reorder, translation mode, discount mode) that each needed their own state, effect and handler.
 */
export default function ChoiceSettingCard<T extends string>({ settingKey, title, subtitle, icon, options, defaultValue, onChange }: Props<T>) {
  const [value, setValue] = useState<T>(defaultValue);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/settings/${settingKey}`)
      .then(r => (r.ok ? r.json() : null))
      .then(d => {
        if (cancelled || !d?.value) return;
        const v = d.value as T;
        if (options.some(o => o.value === v)) { setValue(v); onChange?.(v); }
      })
      .catch(() => { /* keep the default */ });
    return () => { cancelled = true; if (timer.current) clearTimeout(timer.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settingKey]);

  const choose = async (next: T) => {
    const previous = value;
    setValue(next);
    onChange?.(next);
    try {
      const res = await fetch('/api/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key: settingKey, value: next }) });
      if (!res.ok) throw new Error('save failed');
      setStatus('success');
    } catch {
      setValue(previous);
      onChange?.(previous);
      setStatus('error');
      toast('Could not save the setting.', 'error');
    }
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setStatus('idle'), 2000);
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <div className="p-6 border-b border-gray-200 bg-gray-50 flex items-center gap-3">
        {icon}
        <div>
          <h2 className="text-xl font-semibold text-gray-800">{title}</h2>
          <p className="text-sm text-gray-500 mt-0.5">{subtitle}</p>
        </div>
      </div>
      <div className="p-6 flex items-center justify-between gap-8">
        <div role="radiogroup" aria-label={typeof title === 'string' ? title : settingKey} className="space-y-3 flex-1">
          {options.map(o => {
            const selected = value === o.value;
            return (
              <div
                key={o.value}
                role="radio"
                aria-checked={selected}
                tabIndex={0}
                onClick={() => choose(o.value)}
                onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); choose(o.value); } }}
                className={`flex items-start gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-500 ${selected ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'}`}
              >
                <div className={`w-5 h-5 rounded-full border-2 mt-0.5 shrink-0 flex items-center justify-center ${selected ? 'border-indigo-500' : 'border-gray-300'}`}>
                  {selected && <div className="w-2.5 h-2.5 rounded-full bg-indigo-500" />}
                </div>
                <div>
                  <p className="font-semibold text-gray-800">{o.title}</p>
                  <p className="text-sm text-gray-500 mt-0.5">{o.description}</p>
                </div>
              </div>
            );
          })}
        </div>
        <div className="flex flex-col items-center gap-1 shrink-0" aria-live="polite">
          {status === 'success' && <span className="text-emerald-600 text-xs font-medium">Saved ✓</span>}
          {status === 'error' && <span className="text-red-600 text-xs font-medium">Save failed</span>}
        </div>
      </div>
    </div>
  );
}
