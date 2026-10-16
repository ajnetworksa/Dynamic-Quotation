// Safe localStorage helpers. A corrupt value must never crash the whole app (white screen).

export function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null || raw === '') return fallback;
    const parsed = JSON.parse(raw);
    return parsed === null || parsed === undefined ? fallback : (parsed as T);
  } catch {
    return fallback;
  }
}

/** The logged-in user object cached by the app, or {} when missing/corrupt. */
export function getStoredUser(): any {
  return readJson<any>('user', {});
}

/** Everything the app keeps in localStorage that belongs to a logged-in session. */
export function clearSessionStorage(): void {
  try {
    ['token', 'user', 'quote_draft', 'currentQuoteId'].forEach(k => localStorage.removeItem(k));
  } catch {
    /* storage unavailable */
  }
}
