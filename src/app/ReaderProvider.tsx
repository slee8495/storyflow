"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { useUiLanguage } from "./UiLanguageProvider";

const STORAGE_KEY = "storyflow:reader";

type Reader = { id: number; name: string };

type ReaderContextValue = {
  reader: Reader | null;
  // Undefined while still checking localStorage on first mount — lets the gate avoid a flash of
  // "enter your name" before a saved name has had a chance to load.
  loading: boolean;
  claim: (name: string) => Promise<void>;
  signOut: () => void;
};

const ReaderContext = createContext<ReaderContextValue | null>(null);

export function ReaderProvider({ children }: { children: React.ReactNode }) {
  const [reader, setReader] = useState<Reader | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLoading(false);
      return;
    }
    try {
      const parsed = JSON.parse(stored) as Reader;
      if (parsed?.id && parsed?.name) setReader(parsed);
    } catch {
      // corrupt localStorage value — fall through to the name gate
    }
    setLoading(false);
  }, []);

  async function claim(name: string) {
    const res = await fetch("/api/reader", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (!res.ok) throw new Error("failed to claim reader name");
    const { reader: claimed } = await res.json();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(claimed));
    setReader(claimed);
  }

  function signOut() {
    localStorage.removeItem(STORAGE_KEY);
    setReader(null);
  }

  return (
    <ReaderContext.Provider value={{ reader, loading, claim, signOut }}>
      {children}
    </ReaderContext.Provider>
  );
}

export function useReader() {
  const ctx = useContext(ReaderContext);
  if (!ctx) throw new Error("useReader must be used within ReaderProvider");
  return ctx;
}

// Full-screen name entry — the only "auth" screen this app has. Shown whenever there's no reader
// claimed yet (first visit on a device, or after signOut()).
export function ReaderGate() {
  const { claim } = useReader();
  const { t } = useUiLanguage();
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || submitting) return;
    setSubmitting(true);
    setError(false);
    try {
      await claim(name);
    } catch {
      setError(true);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center gap-6 px-4 text-center">
      <div>
        <h1 className="text-xl font-semibold text-[var(--ink)]">Storyflow</h1>
        <p className="mt-2 text-sm text-[var(--ink-soft)]">{t("gate.title")}</p>
      </div>
      <form onSubmit={handleSubmit} className="flex w-full max-w-xs flex-col gap-3">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t("gate.placeholder")}
          autoFocus
          className="rounded-lg border border-[var(--line)] bg-[var(--paper-raised)] px-3 py-2 text-sm text-[var(--ink)] outline-none focus:border-[var(--clay)]"
        />
        {error && <p className="text-xs text-red-600 dark:text-red-400">{t("gate.error")}</p>}
        <button
          type="submit"
          disabled={!name.trim() || submitting}
          className="rounded-lg bg-[var(--clay-deep)] px-3 py-2 text-sm font-medium text-[var(--paper-raised)] disabled:opacity-50"
        >
          {submitting ? t("gate.submitting") : t("gate.submit")}
        </button>
      </form>
    </div>
  );
}
