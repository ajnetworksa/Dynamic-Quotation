// Minimum password length, set by Settings → "Require strong passwords (10+ characters)".
// OFF by default (4 characters, as before). The server enforces the same rule (/api/password-policy).
import { useEffect, useState } from 'react';

let cached: number | null = null;
let pending: Promise<number> | null = null;

export function fetchPasswordMinLength(force = false): Promise<number> {
  if (!force && cached !== null) return Promise.resolve(cached);
  if (!force && pending) return pending;
  const p: Promise<number> = fetch('/api/password-policy')
    .then(r => (r.ok ? r.json() : null))
    .then((d): number => { const v = typeof d?.minLength === 'number' ? d.minLength : 4; cached = v; return v; })
    .catch((): number => 4)
    .finally(() => { pending = null; });
  pending = p;
  return p;
}

export function usePasswordMinLength(): number {
  const [min, setMin] = useState<number>(cached ?? 4);
  useEffect(() => { let alive = true; fetchPasswordMinLength().then(v => { if (alive) setMin(v); }); return () => { alive = false; }; }, []);
  return min;
}

/** Call after the setting is changed so open forms pick up the new rule. */
export function invalidatePasswordPolicy() { cached = null; }
