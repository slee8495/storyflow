"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ReaderGate, useReader } from "./ReaderProvider";
import { useUiLanguage } from "./UiLanguageProvider";

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
};

export default function LibraryPage() {
  const { reader, loading: readerLoading } = useReader();
  const { uiLang, t } = useUiLanguage();
  const [books, setBooks] = useState<LibraryBook[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

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
      <p className="text-sm text-[var(--ink-soft)]">
        {t("library.greeting")} {reader.name}
      </p>

      {loading && <p className="text-sm text-[var(--ink-soft)]">{t("library.loading")}</p>}
      {error && <p className="text-sm text-red-600 dark:text-red-400">{t("library.error")}</p>}
      {!loading && !error && books.length === 0 && (
        <p className="text-sm text-[var(--ink-soft)]">{t("library.empty")}</p>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {books.map((book) => {
          const title = uiLang === "en" ? (book.titleEn ?? book.title) : book.title;
          const progressPct =
            book.bookmarkChapter && book.totalChapters
              ? Math.min(100, Math.round((book.bookmarkChapter / book.totalChapters) * 100))
              : 0;
          return (
            <Link
              key={book.id}
              href={
                book.bookmarkChapter ? `/book/${book.slug}/${book.bookmarkChapter}` : `/book/${book.slug}`
              }
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
