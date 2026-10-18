"use client";

import { useEffect, useState } from "react";
import { useUiLanguage } from "./UiLanguageProvider";

// The reader's own calendar day — a book finished at 1am counts for the day they saw.
export function localToday(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function formatDay(day: string, uiLang: "ko" | "en"): string {
  return new Intl.DateTimeFormat(uiLang === "ko" ? "ko-KR" : "en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date(`${day}T00:00:00`));
}

// "다 읽었어요" on the book page and at the end of the last chapter: marks the book finished
// today (which moves it to the library's Finished tab), lets the date be corrected, or undoes it.
export function FinishControl({ slug, readerId, prominent = false }: { slug: string; readerId: number; prominent?: boolean }) {
  const { uiLang, t } = useUiLanguage();
  const [finishedOn, setFinishedOn] = useState<string | null | undefined>(undefined);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    fetch(`/api/books/${slug}/finish?readerId=${readerId}`)
      .then((res) => (res.ok ? res.json() : { finishedOn: null }))
      .then((json: { finishedOn: string | null }) => setFinishedOn(json.finishedOn))
      .catch(() => setFinishedOn(null));
  }, [slug, readerId]);

  async function save(day: string) {
    setFinishedOn(day);
    setEditing(false);
    await fetch(`/api/books/${slug}/finish`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ readerId, finishedOn: day }),
    }).catch(() => {});
  }

  async function undo() {
    setFinishedOn(null);
    setEditing(false);
    await fetch(`/api/books/${slug}/finish?readerId=${readerId}`, { method: "DELETE" }).catch(() => {});
  }

  if (finishedOn === undefined) return null;

  if (!finishedOn) {
    return (
      <button
        onClick={() => save(localToday())}
        className={
          prominent
            ? "self-center rounded-lg bg-[var(--clay-deep)] px-5 py-2.5 text-sm font-medium text-[var(--paper-raised)]"
            : "self-start rounded-lg border border-[var(--line)] px-4 py-2 text-sm text-[var(--ink-soft)] hover:border-[var(--clay)] hover:text-[var(--ink)]"
        }
      >
        📗 {t("finish.mark")}
      </button>
    );
  }

  return (
    <div className={`flex flex-col gap-2 rounded-xl bg-[var(--clay-tint)] px-3 py-2.5 ${prominent ? "self-stretch" : "self-start"}`}>
      <p className="text-sm text-[var(--ink)]">
        📗 {t("finish.done").replace("{date}", formatDay(finishedOn, uiLang))}
      </p>
      {editing ? (
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <input
            type="date"
            defaultValue={finishedOn}
            max={localToday()}
            onChange={(e) => e.target.value && save(e.target.value)}
            className="rounded-lg border border-[var(--line)] bg-[var(--paper)] px-2 py-1 text-[var(--ink)]"
          />
          <button onClick={() => setEditing(false)} className="text-[var(--ink-soft)]">
            {t("marks.cancel")}
          </button>
        </div>
      ) : (
        <div className="flex gap-3 text-xs text-[var(--ink-soft)]">
          <button onClick={() => setEditing(true)} className="hover:text-[var(--ink)]">
            {t("finish.changeDate")}
          </button>
          <button onClick={undo} className="hover:text-[var(--ink)]">
            {t("finish.undo")}
          </button>
        </div>
      )}
    </div>
  );
}
