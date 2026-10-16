import React, { useEffect, useState, useCallback } from 'react';
import { X, ShieldCheck, Smartphone, LogOut, Loader2 } from 'lucide-react';
import { toast, confirmAsync } from '../lib/notify';

interface SessionRow { id: number; created_at: string | null; expires_at: string; user_agent: string | null; ip: string | null; current: boolean }

const describeAgent = (ua: string | null) => {
  if (!ua) return 'Unknown device';
  const browser = /Edg\//.test(ua) ? 'Edge' : /Chrome\//.test(ua) ? 'Chrome' : /Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : 'Browser';
  const os = /Windows/.test(ua) ? 'Windows' : /Android/.test(ua) ? 'Android' : /iPhone|iPad/.test(ua) ? 'iOS' : /Mac OS X/.test(ua) ? 'macOS' : /Linux/.test(ua) ? 'Linux' : '';
  return `${browser}${os ? ' on ' + os : ''}`;
};

/** Account security: two-factor authentication (authenticator app) and the list of devices that are signed in. */
export default function SecurityModal({ onClose }: { onClose: () => void }) {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [setup, setSetup] = useState<{ secret: string; qrDataUrl: string } | null>(null);
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const [meRes, sesRes] = await Promise.all([fetch('/api/me'), fetch('/api/me/sessions')]);
      if (meRes.ok) setEnabled(!!(await meRes.json()).twoFactorEnabled);
      if (sesRes.ok) setSessions(await sesRes.json());
    } catch { setError('Could not load your security settings.'); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const post = async (url: string, body?: any) => {
    setBusy(true); setError('');
    try {
      const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setError(data.error || 'Something went wrong.'); return null; }
      return data;
    } catch { setError('Network error.'); return null; } finally { setBusy(false); }
  };

  const startSetup = async () => { const d = await post('/api/me/2fa/setup'); if (d) { setSetup({ secret: d.secret, qrDataUrl: d.qrDataUrl }); setCode(''); } };
  const confirmSetup = async () => {
    const d = await post('/api/me/2fa/enable', { code });
    if (d) { setSetup(null); setCode(''); toast('Two-factor authentication is now on.', 'success'); load(); }
  };
  const turnOff = async () => {
    const d = await post('/api/me/2fa/disable', { password, code });
    if (d) { setPassword(''); setCode(''); toast('Two-factor authentication is off.', 'success'); load(); }
  };
  const revoke = async (id: number) => {
    if (!await confirmAsync('Sign this device out?')) return;
    await fetch(`/api/me/sessions/${id}`, { method: 'DELETE' });
    load();
  };
  const revokeOthers = async () => {
    if (!await confirmAsync('Sign out every other device?')) return;
    const d = await post('/api/me/sessions/revoke-others');
    if (d) { toast(`Signed out ${d.revoked} other device(s).`, 'success'); load(); }
  };

  return (
    <div role="dialog" aria-modal="true" aria-label="Account security" className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-gray-200">
          <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2"><ShieldCheck className="text-indigo-600" size={20} /> Account security</h2>
          <button onClick={onClose} aria-label="Close" className="p-1 text-gray-400 hover:text-gray-600 rounded"><X size={20} /></button>
        </div>

        <div className="p-5 space-y-6">
          {error && <div role="alert" className="bg-red-50 text-red-700 text-sm p-3 rounded-lg">{error}</div>}

          <section aria-labelledby="sec-2fa">
            <h3 id="sec-2fa" className="font-semibold text-gray-800 flex items-center gap-2"><Smartphone size={16} /> Two-factor authentication</h3>
            <p className="text-sm text-gray-500 mt-1">Adds a 6-digit code from an authenticator app (Google Authenticator, Microsoft Authenticator, Authy) to your login.</p>

            {enabled === null && <Loader2 className="animate-spin mt-3 text-indigo-600" size={18} />}

            {enabled === false && !setup && (
              <button onClick={startSetup} disabled={busy} className="mt-3 px-4 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50">Set up</button>
            )}

            {setup && (
              <div className="mt-3 space-y-3">
                <p className="text-sm text-gray-700">1. Scan this QR code with your authenticator app (or type the key by hand).</p>
                <div className="flex flex-col items-center gap-2">
                  <img src={setup.qrDataUrl} alt="QR code for your authenticator app" width={220} height={220} className="border rounded" />
                  <code className="text-xs bg-gray-100 px-2 py-1 rounded break-all select-all">{setup.secret}</code>
                </div>
                <label htmlFor="sec-code" className="block text-sm text-gray-700">2. Enter the 6-digit code it shows:</label>
                <div className="flex gap-2">
                  <input id="sec-code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
                    className="border border-gray-300 rounded-lg px-3 py-2 font-mono tracking-widest w-36" placeholder="123456" />
                  <button onClick={confirmSetup} disabled={busy || code.length !== 6} className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50">Turn on</button>
                  <button onClick={() => { setSetup(null); setCode(''); }} className="px-3 py-2 text-gray-600 border border-gray-300 rounded-lg">Cancel</button>
                </div>
              </div>
            )}

            {enabled === true && (
              <div className="mt-3 space-y-2">
                <p className="text-sm text-emerald-700 font-medium">Two-factor authentication is ON.</p>
                <p className="text-xs text-gray-500">To turn it off, confirm your password and a current code:</p>
                <div className="flex flex-wrap gap-2">
                  <input type="password" autoComplete="current-password" aria-label="Password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-2" />
                  <input inputMode="numeric" autoComplete="one-time-code" aria-label="Authentication code" maxLength={6} placeholder="123456" value={code} onChange={e => setCode(e.target.value.replace(/\D/g, ''))} className="border border-gray-300 rounded-lg px-3 py-2 font-mono tracking-widest w-32" />
                  <button onClick={turnOff} disabled={busy || !password || code.length !== 6} className="px-4 py-2 border border-red-300 text-red-700 rounded-lg hover:bg-red-50 disabled:opacity-50">Turn off</button>
                </div>
              </div>
            )}
          </section>

          <section aria-labelledby="sec-sessions">
            <div className="flex items-center justify-between">
              <h3 id="sec-sessions" className="font-semibold text-gray-800">Signed-in devices</h3>
              {sessions.length > 1 && <button onClick={revokeOthers} className="text-sm text-red-600 hover:underline">Sign out all others</button>}
            </div>
            <ul className="mt-2 divide-y divide-gray-100 border border-gray-200 rounded-lg">
              {sessions.map(s => (
                <li key={s.id} className="flex items-center justify-between gap-3 p-3 text-sm">
                  <div className="min-w-0">
                    <p className="font-medium text-gray-800">{describeAgent(s.user_agent)} {s.current && <span className="ml-1 text-xs bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded">this device</span>}</p>
                    <p className="text-xs text-gray-500">{s.ip || 'unknown IP'} · signed in {s.created_at ? new Date(s.created_at).toLocaleString() : 'earlier'}</p>
                  </div>
                  {!s.current && <button onClick={() => revoke(s.id)} aria-label="Sign this device out" className="p-1.5 text-red-600 hover:bg-red-50 rounded"><LogOut size={16} /></button>}
                </li>
              ))}
              {sessions.length === 0 && <li className="p-3 text-sm text-gray-400">No sessions.</li>}
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}
