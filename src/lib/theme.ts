export const THEME_STORAGE_KEY = "storyflow:theme";

// "system" follows the device's light/dark setting; "night" is for reading in a dark room — a
// pure black page with dim, warm (low blue) text, so the screen gives off as little light as
// possible.
export const THEMES = ["system", "light", "dark", "night"] as const;
export type Theme = (typeof THEMES)[number];

export const DEFAULT_THEME: Theme = "system";

export function isValidTheme(value: unknown): value is Theme {
  return THEMES.includes(value as Theme);
}
