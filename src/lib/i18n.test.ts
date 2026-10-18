import { describe, it, expect, beforeEach } from 'vitest';

// Minimal browser stand-ins so the module can run under node.
beforeEach(() => {
  (globalThis as any).localStorage = { _s: {} as Record<string, string>, getItem(k: string) { return this._s[k] ?? null; }, setItem(k: string, v: string) { this._s[k] = v; } };
  (globalThis as any).document = { documentElement: {} };
});

describe('i18n', () => {
  it('falls back to English and translates after switching', async () => {
    const { t, setLang } = await import('./i18n');
    expect(t('Dashboard')).toBe('Dashboard');
    setLang('ar');
    expect(t('Dashboard')).toBe('لوحة التحكم');
    expect(t('Something not in the dictionary')).toBe('Something not in the dictionary');
    expect((globalThis as any).document.documentElement.dir).toBe('rtl');
    setLang('en');
    expect((globalThis as any).document.documentElement.dir).toBe('ltr');
  });
});
