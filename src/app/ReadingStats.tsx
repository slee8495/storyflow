"use client";

import { useState } from "react";
import Link from "next/link";
import { formatDay, localToday } from "./FinishControl";
import { ChevronIcon } from "./ChevronIcon";
import { useUiLanguage } from "./UiLanguageProvider";

export type FinishedEntry = {
  slug: string;
  title: string;
  author: string | null;
  coverColor: string | null;
  finishedOn: string; // YYYY-MM-DD, the reader's local day
};

// The library's "독서 기록" tab: books finished this month / this year / ever, a month-by-month
// chart for one year (stepping back through earlier years), and a per-year tally.
export function ReadingStats({ finished }: { finished: FinishedEntry[] }) {
  const { uiLang, t } = useUiLanguage();
  const today = localToday();
  const thisYear = Number(today.slice(0, 4));
  const thisMonth = today.slice(0, 7);
  const [year, setYear] = useState(thisYear);

  const years = [...new Set(finished.map((f) => Number(f.finishedOn.slice(0, 4))))];
  const firstYear = Math.min(thisYear, ...years);
  const inYear = finished.filter((f) => Number(f.finishedOn.slice(0, 4)) === year);
  const perMonth = Array.from({ length: 12 }, (_, m) =>
    inYear.filter((f) => Number(f.finishedOn.slice(5, 7)) === m + 1),
  );
  const monthMax = Math.max(1, ...perMonth.map((b) => b.length));
  const perYear = Array.from({ length: thisYear - firstYear + 1 }, (_, i) => thisYear - i).map((y) => ({
    year: y,
    count: finished.filter((f) => Number(f.finishedOn.slice(0, 4)) === y).length,
  }));
  const yearMax = Math.max(1, ...perYear.map((y) => y.count));
  const monthLabel = (m: number) =>
    new Intl.DateTimeFormat(uiLang === "ko" ? "ko-KR" : "en-US", { month: "short" }).format(new Date(2000, m, 1));
  const books = (n: number) => (uiLang === "ko" ? `${n}${t("stats.booksUnit")}` : `${n} ${n === 1 ? "book" : "books"}`);

  const tiles = [
    { label: t("stats.thisMonth"), count: finished.filter((f) => f.finishedOn.startsWith(thisMonth)).length },
    { label: t("stats.thisYear"), count: finished.filter((f) => f.finishedOn.startsWith(String(thisYear))).length },
    { label: t("stats.allTime"), count: finished.length },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-3 gap-2">
        {tiles.map((tile) => (
          <div key={tile.label} className="rounded-xl border border-[var(--line)] bg-[var(--paper-raised)] p-3 text-center shadow-sm">
            <p className="text-xs text-[var(--ink-soft)]">{tile.label}</p>
            <p className="mt-1 text-2xl font-semibold text-[var(--ink)]">{tile.count}</p>
            <p className="text-[0.7rem] text-[var(--ink-soft)]">{uiLang === "ko" ? t("stats.booksUnit") : tile.count === 1 ? "book" : "books"}</p>
          </div>
        ))}
      </div>

      {finished.length === 0 && <p className="text-sm text-[var(--ink-soft)]">{t("stats.empty")}</p>}

      <section className="flex flex-col gap-3 rounded-xl border border-[var(--line)] bg-[var(--paper-raised)] p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-[var(--ink-soft)]">{t("stats.byMonth").replace("{year}", String(year))}</h2>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setYear((y) => y - 1)}
              disabled={year <= firstYear}
              className="rounded-full p-1.5 text-[var(--ink-soft)] hover:bg-[var(--clay-tint)] disabled:opacity-30"
              aria-label={String(year - 1)}
            >
              <ChevronIcon direction="left" />
            </button>
            <button
              onClick={() => setYear((y) => y + 1)}
              disabled={year >= thisYear}
              className="rounded-full p-1.5 text-[var(--ink-soft)] hover:bg-[var(--clay-tint)] disabled:opacity-30"
              aria-label={String(year + 1)}
            >
              <ChevronIcon direction="right" />
            </button>
          </div>
        </div>
        <div className="flex h-32 items-end gap-1">
          {perMonth.map((list, m) => (
            <div key={m} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
              {list.length > 0 && <span className="text-[0.65rem] font-medium text-[var(--ink)]">{list.length}</span>}
              <div
                className="w-full rounded-t bg-[var(--clay)]"
                style={{ height: `${(list.length / monthMax) * 100}%`, minHeight: list.length ? 4 : 0 }}
              />
              <div className={`h-px w-full ${list.length ? "" : "bg-[var(--line)]"}`} />
            </div>
          ))}
        </div>
        <div className="flex gap-1">
          {perMonth.map((_, m) => (
            <span key={m} className="flex-1 text-center text-[0.6rem] text-[var(--ink-soft)]">
              {uiLang === "ko" ? m + 1 : monthLabel(m).slice(0, 1)}
            </span>
          ))}
        </div>
        {inYear.length > 0 && (
          <ul className="flex flex-col gap-2 border-t border-[var(--line)] pt-3">
            {[...inYear]
              .sort((a, b) => b.finishedOn.localeCompare(a.finishedOn))
              .map((f) => (
                <li key={f.slug}>
                  <Link href={`/book/${f.slug}`} className="flex items-center gap-2 text-sm hover:opacity-80">
                    <span className="h-3 w-3 shrink-0 rounded-sm" style={{ backgroundColor: f.coverColor ?? "var(--clay-deep)" }} />
                    <span className="min-w-0 flex-1 truncate text-[var(--ink)]">{f.title}</span>
                    <span className="shrink-0 text-xs text-[var(--ink-soft)]">{formatDay(f.finishedOn, uiLang)}</span>
                  </Link>
                </li>
              ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-2 rounded-xl border border-[var(--line)] bg-[var(--paper-raised)] p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-[var(--ink-soft)]">{t("stats.byYear")}</h2>
        {perYear.map(({ year: y, count }) => (
          <button key={y} onClick={() => setYear(y)} className="flex items-center gap-3 text-left text-sm">
            <span className={`w-12 shrink-0 ${y === year ? "font-semibold text-[var(--ink)]" : "text-[var(--ink-soft)]"}`}>{y}</span>
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-[var(--clay-tint)]">
              <div className="h-full rounded-full bg-[var(--clay)]" style={{ width: `${(count / yearMax) * 100}%` }} />
            </div>
            <span className="w-14 shrink-0 text-right text-xs text-[var(--ink-soft)]">{books(count)}</span>
          </button>
        ))}
      </section>
    </div>
  );
}
