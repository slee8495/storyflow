"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ReaderGate, useReader } from "../ReaderProvider";
import { useUiLanguage } from "../UiLanguageProvider";
import { ChevronIcon } from "../ChevronIcon";
import { formatDay } from "../FinishControl";

type PlanBook = {
  slug: string;
  title: string;
  titleEn: string | null;
  author: string | null;
  coverColor: string | null;
  inLibrary: boolean;
  totalChapters: number;
  readyChapters: number;
  reading: boolean;
  finishedOn: string | null;
  nightsUntilReady?: number;
};

// The nightly batch runs at 06:00 local: the first run still ahead is this morning's if it's
// before six, else tomorrow's. A book needing N runs is done on the Nth.
function readyDay(nights: number): string {
  const day = new Date();
  if (day.getHours() >= 6) day.setDate(day.getDate() + 1);
  day.setDate(day.getDate() + nights - 1);
  return `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}`;
}

// "Projected order": the books to read next, in order. Reordering or removing saves at once
// (PUT /api/plan with the new list) — the nightly translation follows this order.
export default function PlanPage() {
  const { reader, loading: readerLoading } = useReader();
  const { uiLang, t } = useUiLanguage();
  const [entries, setEntries] = useState<PlanBook[]>([]);
  const [available, setAvailable] = useState<PlanBook[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  async function load(readerId: number) {
    const res = await fetch(`/api/plan?readerId=${readerId}`);
    if (!res.ok) throw new Error("failed to load plan");
    const data: { entries: PlanBook[]; available: PlanBook[] } = await res.json();
    setEntries(data.entries);
    setAvailable(data.available);
  }

  useEffect(() => {
    if (!reader) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load(reader.id)
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [reader]);

  async function save(next: PlanBook[]) {
    if (!reader) return;
    setEntries(next);
    setError(false);
    const res = await fetch("/api/plan", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slugs: next.map((b) => b.slug) }),
    }).catch(() => null);
    if (!res?.ok) setError(true);
    // Re-read so the projected dates and the "not on the list" section follow the new order.
    await load(reader.id).catch(() => setError(true));
  }

  function move(index: number, by: -1 | 1) {
    const next = [...entries];
    [next[index], next[index + by]] = [next[index + by], next[index]];
    save(next);
  }

  if (readerLoading) return null;
  if (!reader) return <ReaderGate />;

  const title = (b: PlanBook) => (uiLang === "en" ? (b.titleEn ?? b.title) : b.title);
  const status = (b: PlanBook) => {
    if (b.finishedOn) return t("plan.finished").replace("{date}", formatDay(b.finishedOn, uiLang));
    const translated = b.inLibrary && b.readyChapters >= b.totalChapters;
    const date = b.nightsUntilReady ? formatDay(readyDay(b.nightsUntilReady), uiLang) : "";
    const line = translated
      ? t("plan.ready").replace("{total}", String(b.totalChapters))
      : b.inLibrary
        ? t("plan.translating")
            .replace("{ready}", String(b.readyChapters))
            .replace("{total}", String(b.totalChapters))
            .replace("{date}", date)
        : t("plan.queued").replace("{total}", String(b.totalChapters)).replace("{date}", date);
    return b.reading ? `${t("plan.reading")} · ${line}` : line;
  };
  const iconButton = "flex h-8 w-8 items-center justify-center rounded-full text-[var(--ink-soft)] hover:bg-[var(--clay-tint)] hover:text-[var(--ink)] disabled:opacity-25 disabled:hover:bg-transparent";

  return (
    <div className="flex flex-col gap-4">
      <Link href="/" className="flex w-fit items-center gap-1 text-sm text-[var(--ink-soft)] hover:text-[var(--ink)]">
        <ChevronIcon direction="left" /> {t("nav.library")}
      </Link>
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold text-[var(--ink)]">{t("plan.title")}</h1>
        <p className="text-sm text-[var(--ink-soft)]">{t("plan.hint")}</p>
      </div>

      {loading && <p className="text-sm text-[var(--ink-soft)]">{t("library.loading")}</p>}
      {error && <p className="text-sm text-red-600 dark:text-red-400">{t("plan.saveError")}</p>}
      {!loading && entries.length === 0 && <p className="text-sm text-[var(--ink-soft)]">{t("plan.empty")}</p>}

      <ol className="flex flex-col gap-2">
        {entries.map((b, i) => (
          <li
            key={b.slug}
            className="flex items-center gap-3 rounded-xl border border-[var(--line)] bg-[var(--paper-raised)] p-2.5 shadow-sm"
          >
            <span className="w-5 shrink-0 text-center text-sm font-semibold tabular-nums text-[var(--ink-soft)]">{i + 1}</span>
            <span className="h-10 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: b.coverColor ?? "var(--clay-deep)" }} />
            <div className="min-w-0 flex-1">
              {b.inLibrary ? (
                <Link href={`/book/${b.slug}`} className="block truncate text-sm font-semibold text-[var(--ink)] hover:underline">
                  {title(b)}
                </Link>
              ) : (
                <p className="truncate text-sm font-semibold text-[var(--ink)]">{title(b)}</p>
              )}
              {b.author && <p className="truncate text-xs text-[var(--ink-soft)]">{b.author}</p>}
              <p className="text-[0.7rem] text-[var(--clay-deep)]">{status(b)}</p>
            </div>
            <div className="flex shrink-0 items-center">
              <button className={iconButton} onClick={() => move(i, -1)} disabled={i === 0} aria-label={t("plan.up")}>
                <ChevronIcon direction="left" className="rotate-90" />
              </button>
              <button className={iconButton} onClick={() => move(i, 1)} disabled={i === entries.length - 1} aria-label={t("plan.down")}>
                <ChevronIcon direction="left" className="-rotate-90" />
              </button>
              <button className={iconButton} onClick={() => save(entries.filter((e) => e.slug !== b.slug))} aria-label={t("plan.remove")}>
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </div>
          </li>
        ))}
      </ol>

      {available.length > 0 && (
        <section className="flex flex-col gap-2 pt-2">
          <h2 className="text-sm font-semibold text-[var(--ink-soft)]">{t("plan.removedTitle")}</h2>
          {available.map((b) => (
            <div key={b.slug} className="flex items-center gap-3 rounded-xl border border-dashed border-[var(--line)] p-2.5">
              <span className="h-8 w-1.5 shrink-0 rounded-full opacity-60" style={{ backgroundColor: b.coverColor ?? "var(--clay-deep)" }} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-[var(--ink)]">{title(b)}</p>
                {b.author && <p className="truncate text-xs text-[var(--ink-soft)]">{b.author}</p>}
              </div>
              <button
                onClick={() => save([...entries, b])}
                className="shrink-0 rounded-lg border border-[var(--line)] px-3 py-1.5 text-xs font-medium text-[var(--ink-soft)] hover:border-[var(--clay)] hover:text-[var(--ink)]"
              >
                {t("plan.addBack")}
              </button>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
