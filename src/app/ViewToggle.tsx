"use client";

import { useEffect, useState } from "react";
import { useUiLanguage } from "./UiLanguageProvider";

// "Large icons" vs "list", like a file browser's view switch. Remembered per screen (library vs
// a book's chapter list) on this device only — it's a viewing preference, not reading progress.
export type ViewMode = "grid" | "list";

export function useViewMode(storageKey: string): [ViewMode, (mode: ViewMode) => void] {
  const [mode, setMode] = useState<ViewMode>("grid");
  useEffect(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (stored === "grid" || stored === "list") setMode(stored);
    } catch {}
  }, [storageKey]);
  function update(next: ViewMode) {
    setMode(next);
    try {
      localStorage.setItem(storageKey, next);
    } catch {}
  }
  return [mode, update];
}

export function ViewToggle({ mode, onChange }: { mode: ViewMode; onChange: (mode: ViewMode) => void }) {
  const { t } = useUiLanguage();
  const button = (value: ViewMode, label: string, icon: React.ReactNode) => (
    <button
      onClick={() => onChange(value)}
      aria-label={label}
      aria-pressed={mode === value}
      title={label}
      className={`rounded-full p-1.5 ${
        mode === value ? "bg-[var(--paper-raised)] text-[var(--ink)] shadow-sm" : "text-[var(--ink-soft)]"
      }`}
    >
      {icon}
    </button>
  );
  const svg = (children: React.ReactNode) => (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  );
  return (
    <div className="flex gap-0.5 rounded-full bg-[var(--clay-tint)] p-0.5">
      {button(
        "grid",
        t("view.grid"),
        svg(
          <>
            <rect x="4" y="4" width="6.5" height="6.5" rx="1" />
            <rect x="13.5" y="4" width="6.5" height="6.5" rx="1" />
            <rect x="4" y="13.5" width="6.5" height="6.5" rx="1" />
            <rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1" />
          </>,
        ),
      )}
      {button(
        "list",
        t("view.list"),
        svg(
          <>
            <path d="M9 6h11M9 12h11M9 18h11" />
            <circle cx="4.5" cy="6" r="0.8" fill="currentColor" />
            <circle cx="4.5" cy="12" r="0.8" fill="currentColor" />
            <circle cx="4.5" cy="18" r="0.8" fill="currentColor" />
          </>,
        ),
      )}
    </div>
  );
}
