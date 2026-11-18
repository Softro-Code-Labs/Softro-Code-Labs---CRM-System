/** Appearance: dark by default; each person can pick light or follow their device. Stored per browser. */
export const THEME_COOKIE = "softro_theme";
export const THEMES = ["dark", "light", "system"] as const;
export type ThemePreference = (typeof THEMES)[number];
export const DEFAULT_THEME: ThemePreference = "dark";

export function parseTheme(value: string | undefined | null): ThemePreference {
  return THEMES.includes(value as ThemePreference) ? (value as ThemePreference) : DEFAULT_THEME;
}

/**
 * Runs before the page paints, only for "system", so following the device never flashes the wrong theme.
 * Also keeps following the device if it switches (e.g. at sunset).
 */
export const SYSTEM_THEME_SCRIPT = `(function(){try{var m=window.matchMedia('(prefers-color-scheme: light)');var a=function(){document.documentElement.dataset.theme=m.matches?'light':'dark'};a();m.addEventListener('change',function(){if(document.documentElement.dataset.themePref==='system')a()})}catch(e){}})();`;
