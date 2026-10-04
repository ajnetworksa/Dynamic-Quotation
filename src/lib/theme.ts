/** App theme: class `.dark` on `<html>` + localStorage (not OS preference alone). */

export function readStoredDarkMode(): boolean {
  try {
    return localStorage.getItem('theme') === 'dark';
  } catch {
    return false;
  }
}

export function applyDarkMode(isDark: boolean): void {
  document.documentElement.classList.toggle('dark', isDark);
  document.documentElement.style.colorScheme = isDark ? 'dark' : 'light';
  try {
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
  } catch {
    /* private browsing */
  }
}

/** Call once before React paints (see index.html). */
export function initThemeFromStorage(): void {
  applyDarkMode(readStoredDarkMode());
}
