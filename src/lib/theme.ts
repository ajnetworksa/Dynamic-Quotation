/** App theme: class `.dark` on `<html>` + localStorage. With no saved choice it follows the OS setting. */

export function readStoredDarkMode(): boolean {
  try {
    const saved = localStorage.getItem('theme');
    if (saved) return saved === 'dark';
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  } catch {
    return false;
  }
}

export function hasSavedTheme(): boolean {
  try {
    return !!localStorage.getItem('theme');
  } catch {
    return false;
  }
}

/** Applies the theme to the page; `persist` also saves it as the user's choice (the toggle). */
export function applyDarkMode(isDark: boolean, persist = true): void {
  document.documentElement.classList.toggle('dark', isDark);
  document.documentElement.style.colorScheme = isDark ? 'dark' : 'light';
  if (!persist) return;
  try {
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
  } catch {
    /* private browsing */
  }
}

/** Call once before React paints (index.html already does this inline). Does not save, so the OS default keeps working. */
export function initThemeFromStorage(): void {
  applyDarkMode(readStoredDarkMode(), false);
}
