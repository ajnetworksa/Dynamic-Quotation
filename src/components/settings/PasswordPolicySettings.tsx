import React, { useEffect, useState } from 'react';
import { KeyRound } from 'lucide-react';
import { toast } from '../../lib/notify';
import { invalidatePasswordPolicy } from '../../lib/passwordPolicy';

/**
 * "Require strong passwords" (setting `strongPasswords`, default OFF).
 * OFF  → new / changed passwords need 4+ characters (the rule before PR #5).
 * ON   → 10+ characters.
 * Existing passwords keep working either way — nobody is forced to pick a new one.
 */
export default function PasswordPolicySettings() {
  const [on, setOn] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch('/api/settings/strongPasswords')
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (alive) setOn(d?.value === 'true'); })
      .catch(() => { /* default off */ });
    return () => { alive = false; };
  }, []);

  const toggle = async () => {
    const next = !on;
    setSaving(true);
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'strongPasswords', value: String(next) }),
      });
      if (!res.ok) throw new Error('save failed');
      setOn(next);
      invalidatePasswordPolicy();
      toast(next ? 'New passwords now need at least 10 characters.' : 'New passwords need at least 4 characters.', 'success');
    } catch {
      toast('Could not save the password setting.', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <div className="p-6 border-b border-gray-200 bg-gray-50 flex items-center gap-3">
        <KeyRound className="text-indigo-600" size={24} />
        <div>
          <h2 className="text-xl font-semibold text-gray-800">Password Rules</h2>
          <p className="text-sm text-gray-500 mt-0.5">Applies only when a password is created or changed. Existing passwords always keep working.</p>
        </div>
      </div>
      <div className="p-6 flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-gray-800">Require strong passwords (10+ characters)</p>
          <p className="text-xs text-gray-500 mt-0.5">{on ? 'On: new passwords need at least 10 characters.' : 'Off: new passwords need at least 4 characters (as before).'}</p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={on}
          aria-label="Require strong passwords (10+ characters)"
          disabled={saving}
          onClick={toggle}
          className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-60 ${on ? 'bg-indigo-600' : 'bg-gray-300'}`}
        >
          <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${on ? 'translate-x-5' : 'translate-x-0.5'}`} />
        </button>
      </div>
    </div>
  );
}
