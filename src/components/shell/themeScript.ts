/**
 * The pre-paint theme script, apart from the hooks in `prefs.ts` so the root layout (a
 * Server Component) can import it without pulling React hooks into the server graph.
 */

/** The one `localStorage` key this product writes. See `prefs.ts`. */
export const STORAGE_KEY = 'osv:v1';

/**
 * Set `data-theme` on <html> from storage, before first paint.
 *
 * Shipped as its own source text (`PRE_PAINT_SCRIPT`), so it must be self-contained and
 * in syntax every supported browser parses untranspiled: no imports, no `?.`, no `??`.
 * `system` removes the attribute so the CSS media query decides.
 */
export function applyThemeAttribute(key: string): void {
  let theme = 'system';
  try {
    const raw = window.localStorage.getItem(key);
    const stored = raw ? JSON.parse(raw) : null;
    const prefs = stored && stored.v === 1 ? stored.prefs : null;
    if (prefs && (prefs.theme === 'light' || prefs.theme === 'dark')) theme = prefs.theme;
  } catch {
    // Unreadable storage: follow the OS.
  }
  if (theme === 'system') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.setAttribute('data-theme', theme);
}

export const PRE_PAINT_SCRIPT = `try{(${applyThemeAttribute.toString()})(${JSON.stringify(STORAGE_KEY)})}catch(e){}`;
