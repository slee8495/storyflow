"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ReaderGate, useReader } from "./ReaderProvider";
import { useUiLanguage } from "./UiLanguageProvider";
import { useViewMode, ViewToggle } from "./ViewToggle";

type LibraryBook = {
  id: number;
  slug: string;
  title: string;
  titleEn: string | null;
  author: string | null;
  totalChapters: number | null;
  coverColor: string | null;
  description: string | null;
  bookmarkChapter: number | null;
  readyChapters: number;
};

export default function LibraryPage() {
  const { reader, loading: readerLoading } = useReader();
  const { uiLang, t } = useUiLanguage();
  const [books, setBooks] = useState<LibraryBook[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [view, setView] = useViewMode("storyflow:view:library");

  useEffect(() => {
    if (!reader) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    setError(false);
    fetch(`/api/books?readerId=${reader.id}`)
      .then((res) => {
        if (!res.ok) throw new Error("failed to load library");
        return res.json();
      })
      .then(({ books }: { books: LibraryBook[] }) => setBooks(books))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [reader]);

  if (readerLoading) return null;
  if (!reader) return <ReaderGate />;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-[var(--ink-soft)]">
          {t("library.greeting")} {reader.name}
        </p>
        {books.length > 0 && <ViewToggle mode={view} onChange={setView} />}
      </div>

      {loading && <p className="text-sm text-[var(--ink-soft)]">{t("library.loading")}</p>}
      {error && <p className="text-sm text-red-600 dark:text-red-400">{t("library.error")}</p>}
      {!loading && !error && books.length === 0 && (
        <p className="text-sm text-[var(--ink-soft)]">{t("library.empty")}</p>
      )}

      <div className={view === "list" ? "flex flex-col gap-2" : "grid grid-cols-2 gap-3 sm:grid-cols-3"}>
        {books.map((book) => {
          const title = uiLang === "en" ? (book.titleEn ?? book.title) : book.title;
          const progressPct =
            book.bookmarkChapter && book.totalChapters
              ? Math.min(100, Math.round((book.bookmarkChapter / book.totalChapters) * 100))
              : 0;
          const translating = book.totalChapters !== null && book.readyChapters < book.totalChapters;
          const translationBadge = translating ? (
            <span className="text-[0.7rem] text-[var(--clay-deep)]">
              {t("translation.progress")
                .replace("{ready}", String(book.readyChapters))
                .replace("{total}", String(book.totalChapters))}
            </span>
          ) : null;
          const href = book.bookmarkChapter ? `/book/${book.slug}/${book.bookmarkChapter}` : `/book/${book.slug}`;
          if (view === "list") {
            return (
              <Link
                key={book.id}
                href={href}
                className="flex items-center gap-3 rounded-xl border border-[var(--line)] bg-[var(--paper-raised)] p-2.5 shadow-sm transition-colors hover:border-[var(--clay)]"
              >
                <div
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-base font-semibold text-white"
                  style={{ backgroundColor: book.coverColor ?? "var(--clay-deep)" }}
                >
                  {title.slice(0, 1)}
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="truncate text-sm font-semibold text-[var(--ink)]">{title}</h2>
                  {book.author && <p className="truncate text-xs text-[var(--ink-soft)]">{book.author}</p>}
                  {translationBadge}
                  {book.bookmarkChapter ? (
                    <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-[var(--clay-tint)]">
                      <div className="h-full rounded-full bg-[var(--clay)]" style={{ width: `${progressPct}%` }} />
                    </div>
                  ) : null}
                </div>
                <span className="shrink-0 text-xs text-[var(--ink-soft)]">
                  {book.bookmarkChapter ? `${book.bookmarkChapter} ${t("library.resume")}` : t("library.start")}
                </span>
              </Link>
            );
          }
          return (
            <Link
              key={book.id}
              href={href}
              className="flex flex-col gap-2 rounded-xl border border-[var(--line)] bg-[var(--paper-raised)] p-3 shadow-sm transition-colors hover:border-[var(--clay)]"
            >
              <div
                className="flex h-24 w-full items-center justify-center rounded-lg text-2xl font-semibold text-white"
                style={{ backgroundColor: book.coverColor ?? "var(--clay-deep)" }}
              >
                {title.slice(0, 1)}
              </div>
              <div>
                <h2 className="text-sm font-semibold text-[var(--ink)]">{title}</h2>
                {book.author && <p className="text-xs text-[var(--ink-soft)]">{book.author}</p>}
                {translationBadge}
              </div>
              {book.bookmarkChapter ? (
                <div className="flex flex-col gap-1">
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--clay-tint)]">
                    <div
                      className="h-full rounded-full bg-[var(--clay)]"
                      style={{ width: `${progressPct}%` }}
                    />
                  </div>
                  <span className="text-xs text-[var(--ink-soft)]">
                    {book.bookmarkChapter} {t("library.resume")}
                  </span>
                </div>
              ) : (
                <span className="text-xs text-[var(--clay-deep)]">{t("library.start")}</span>
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
