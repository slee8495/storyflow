"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { DEFAULT_THEME, THEME_STORAGE_KEY, isValidTheme, type Theme } from "@/lib/theme";

const ThemeContext = createContext<{
  theme: Theme;
  setTheme: (theme: Theme) => void;
} | null>(null);

// Status-bar / browser chrome color per explicit theme; "system" keeps the media-query pair from
// the layout's viewport metadata.
const CHROME_COLOR: Partial<Record<Theme, string>> = { light: "#f7f5f0", dark: "#1c1d21", night: "#000000" };

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  if (theme === "system") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", theme);
  document.querySelectorAll('meta[name="theme-color"]').forEach((meta) => {
    const color = CHROME_COLOR[theme];
    if (!meta.hasAttribute("data-media")) meta.setAttribute("data-media", meta.getAttribute("media") ?? "");
    if (color) {
      meta.removeAttribute("media");
      meta.setAttribute("content", color);
    } else {
      const media = meta.getAttribute("data-media")!;
      if (media) meta.setAttribute("media", media);
      meta.setAttribute("content", media.includes("dark") ? "#1c1d21" : "#f7f5f0");
    }
  });
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(DEFAULT_THEME);

  useEffect(() => {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (isValidTheme(stored)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setThemeState(stored);
      applyTheme(stored);
    }
  }, []);

  function setTheme(next: Theme) {
    setThemeState(next);
    applyTheme(next);
    localStorage.setItem(THEME_STORAGE_KEY, next);
  }

  return <ThemeContext.Provider value={{ theme, setTheme }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
