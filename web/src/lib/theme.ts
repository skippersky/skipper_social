/**
 * Theme plumbing for the settings preferences tab.
 *
 * DESIGN_SYSTEM.md v2.0 defines a single light palette, so `dark` is offered in
 * the selector but rendered unavailable. Everything still resolves through one
 * `data-theme` attribute so a future dark palette is a CSS-only change.
 */
import type { ResolvedTheme, ThemeMode } from '../types';

export const THEME_STORAGE_KEY = 'ks-theme';
export const THEME_MODES: ThemeMode[] = ['light', 'dark', 'system'];
/** Modes the design system can actually paint today. */
export const THEME_AVAILABLE_MODES: ThemeMode[] = ['light', 'system'];

export function isThemeMode(value: unknown): value is ThemeMode {
  return value === 'light' || value === 'dark' || value === 'system';
}

export function isThemeAvailable(mode: ThemeMode): boolean {
  return THEME_AVAILABLE_MODES.includes(mode);
}

export function prefersDarkScheme(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

/** Collapses the user's choice to the palette that will actually be painted. */
export function resolveTheme(
  mode: ThemeMode,
  prefersDark: boolean = prefersDarkScheme()
): ResolvedTheme {
  if (mode === 'system') return prefersDark ? 'dark' : 'light';
  return mode;
}

export function readStoredTheme(): ThemeMode {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    return isThemeMode(stored) ? stored : 'light';
  } catch {
    return 'light';
  }
}

export function storeTheme(mode: ThemeMode): void {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, mode);
  } catch {
    /* private mode */
  }
}

/** Persists the choice and paints it; returns the resolved palette. */
export function applyTheme(mode: ThemeMode): ResolvedTheme {
  storeTheme(mode);
  const resolved = resolveTheme(mode);
  if (typeof document !== 'undefined') {
    document.documentElement.setAttribute('data-theme', resolved);
  }
  return resolved;
}

/** Re-applies the stored choice; call once during app bootstrap. */
export function initTheme(): ResolvedTheme {
  return applyTheme(readStoredTheme());
}

/**
 * Subscribes to OS palette changes while the user follows the system.
 * Returns an unsubscribe function.
 */
export function watchSystemTheme(onChange: (resolved: ResolvedTheme) => void): () => void {
  if (typeof window === 'undefined' || !window.matchMedia) return () => undefined;
  const query = window.matchMedia('(prefers-color-scheme: dark)');
  const listener = (): void => {
    if (readStoredTheme() !== 'system') return;
    onChange(resolveTheme('system', query.matches));
  };
  if (query.addEventListener) {
    query.addEventListener('change', listener);
    return () => query.removeEventListener('change', listener);
  }
  query.addListener(listener);
  return () => query.removeListener(listener);
}
