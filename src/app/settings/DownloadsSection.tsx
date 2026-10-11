"use client";

import { useEffect, useState } from "react";
import {
  AUTO_DELETE_KEY,
  bookBytes,
  chapterBytes,
  deleteBook,
  deleteBookAudio,
  deleteChapter,
  deleteChapterAudio,
  formatBytes,
  type BookEntry,
} from "@/lib/offline";
import { useOffline } from "../OfflineProvider";
import { useUiLanguage } from "../UiLanguageProvider";

export function DownloadsSection({ readerId }: { readerId: number }) {
  const { supported, manifest } = useOffline();
  const { t } = useUiLanguage();
  const [autoDelete, setAutoDelete] = useState(false);
  const [usage, setUsage] = useState<number | null>(null);

  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setAutoDelete(localStorage.getItem(AUTO_DELETE_KEY) === "1");
    } catch {}
  }, []);

  // Whole-origin usage as the browser counts it — includes app files and anything not in the
  // per-chapter numbers (e.g. pictures whose size can't be read).
  useEffect(() => {
    navigator.storage
      ?.estimate?.()
      .then((e) => setUsage(e.usage ?? null))
      .catch(() => {});
  }, [manifest]);

  function toggleAutoDelete(on: boolean) {
    setAutoDelete(on);
    try {
      localStorage.setItem(AUTO_DELETE_KEY, on ? "1" : "0");
    } catch {}
  }

  if (!supported) return null;
  const books = Object.entries(manifest.books);

  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-[var(--line)] bg-[var(--paper-raised)] p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-[var(--ink-soft)]">{t("offline.manage")}</h2>
        {usage !== null && (
          <span className="text-xs text-[var(--ink-soft)]">
            {t("offline.totalUsage")} {formatBytes(usage)}
          </span>
        )}
      </div>

      {books.length === 0 ? (
        <p className="text-sm text-[var(--ink-soft)]">{t("offline.manageEmpty")}</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {books.map(([slug, book]) => (
            <BookRow key={slug} slug={slug} book={book} readerId={readerId} />
          ))}
        </ul>
      )}

      <label className="flex items-start gap-2 text-sm text-[var(--ink)]">
        <input
          type="checkbox"
          className="mt-1"
          checked={autoDelete}
          onChange={(e) => toggleAutoDelete(e.target.checked)}
        />
        <span>
          {t("offline.autoDelete")}
          <span className="block text-xs text-[var(--ink-soft)]">{t("offline.autoDeleteHint")}</span>
        </span>
      </label>
      <p className="text-xs text-[var(--ink-soft)]">{t("offline.manageHint")}</p>
    </section>
  );
}

function BookRow({ slug, book, readerId }: { slug: string; book: BookEntry; readerId: number }) {
  const { t } = useUiLanguage();
  const [expanded, setExpanded] = useState(false);
  const [busy, setBusy] = useState(false);
  const entries = Object.entries(book.chapters).sort(([a], [b]) => Number(a) - Number(b));
  const textCount = entries.filter(([, c]) => c.text).length;
  const audioCount = entries.filter(([, c]) => c.audio.length > 0).length;

  async function run(action: () => Promise<void>) {
    setBusy(true);
    try {
      await action();
    } finally {
      setBusy(false);
    }
  }

  const smallButton =
    "rounded-lg border border-[var(--line)] px-2 py-1 text-xs text-[var(--ink-soft)] hover:border-[var(--clay)] hover:text-[var(--ink)] disabled:opacity-50";

  return (
    <li className="flex flex-col gap-2 rounded-xl border border-[var(--line)] p-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-medium text-[var(--ink)]">{book.title}</p>
          <p className="text-xs text-[var(--ink-soft)]">
            {t("offline.textChapters")} {textCount} · {t("offline.audioChapters")} {audioCount} {t("offline.chaptersUnit")} ·{" "}
            {formatBytes(bookBytes(book))}
          </p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {audioCount > 0 && (
          <button disabled={busy} className={smallButton} onClick={() => run(() => deleteBookAudio(slug, readerId))}>
            {t("offline.deleteAudio")}
          </button>
        )}
        <button disabled={busy} className={smallButton} onClick={() => run(() => deleteBook(slug, readerId))}>
          {t("offline.deleteAll")}
        </button>
        <button className={smallButton} onClick={() => setExpanded((e) => !e)}>
          {expanded ? t("offline.hideChapters") : t("offline.showChapters")}
        </button>
      </div>
      {expanded && (
        <ul className="flex flex-col divide-y divide-[var(--line)]">
          {entries.map(([n, c]) => (
            <li key={n} className="flex items-center justify-between gap-2 py-1.5 text-xs">
              <span className="text-[var(--ink)]">
                {n} · {c.text ? t("offline.textChapters") : ""}
                {c.audio.length > 0 ? ` + ${t("offline.audioChapters")} (${c.audio.join(", ")})` : ""} ·{" "}
                <span className="text-[var(--ink-soft)]">{formatBytes(chapterBytes(c))}</span>
              </span>
              <span className="flex shrink-0 gap-1.5">
                {c.audio.length > 0 && (
                  <button
                    disabled={busy}
                    className={smallButton}
                    onClick={() => run(() => deleteChapterAudio(slug, Number(n), readerId))}
                  >
                    {t("offline.deleteAudio")}
                  </button>
                )}
                <button
                  disabled={busy}
                  className={smallButton}
                  onClick={() => run(() => deleteChapter(slug, Number(n), readerId))}
                >
                  {t("offline.delete")}
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}
