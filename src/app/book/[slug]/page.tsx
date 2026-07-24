"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ReaderGate, useReader } from "../../ReaderProvider";
import { ChevronIcon } from "../../ChevronIcon";
import { useUiLanguage } from "../../UiLanguageProvider";
import type { UiStringKey } from "@/lib/i18n";

type ChapterListItem = {
  id: number;
  chapterNumber: number;
  sourceTitle: string | null;
  titleKo: string | null;
  titleEn: string | null;
  generatedAt: string | null;
};

type BookDetail = {
  id: number;
  slug: string;
  title: string;
  titleEn: string | null;
  author: string | null;
  totalChapters: number | null;
  description: string | null;
  descriptionEn: string | null;
};

type ProgressData = {
  started: boolean;
  chapterNumber: number | null;
  totalChapters: number | null;
  currentChapterPct: number;
  overallPct: number;
  projected: { date: string; daysRemaining: number } | null;
};

function ProgressCard({ progress, uiLang, t }: { progress: ProgressData; uiLang: "ko" | "en"; t: (k: UiStringKey) => string }) {
  return (
    <section className="flex flex-col gap-3 rounded-xl border border-[var(--line)] bg-[var(--paper-raised)] p-4 shadow-sm">
      <h2 className="text-sm font-semibold text-[var(--ink-soft)]">{t("progress.title")}</h2>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <p className="text-xs text-[var(--ink-soft)]">
            {t("progress.currentChapter")} ({progress.chapterNumber})
          </p>
          <p className="text-xl font-semibold text-[var(--ink)]">{progress.currentChapterPct}%</p>
        </div>
        <div>
          <p className="text-xs text-[var(--ink-soft)]">{t("progress.overall")}</p>
          <p className="text-xl font-semibold text-[var(--ink)]">{progress.overallPct}%</p>
        </div>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--clay-tint)]">
        <div className="h-full rounded-full bg-[var(--clay)]" style={{ width: `${progress.overallPct}%` }} />
      </div>
      <p className="text-xs text-[var(--ink-soft)]">
        {progress.projected
          ? `${t("progress.projected")}: ${new Intl.DateTimeFormat(uiLang === "ko" ? "ko-KR" : "en-US", {
              month: "long",
              day: "numeric",
              year: "numeric",
            }).format(new Date(`${progress.projected.date}T00:00:00Z`))} (${progress.projected.daysRemaining}${t("progress.daysRemaining")})`
          : t("progress.notEnoughData")}
      </p>
    </section>
  );
}

export default function BookPage() {
  const { slug } = useParams<{ slug: string }>();
  const { reader, loading: readerLoading } = useReader();
  const { uiLang, t } = useUiLanguage();
  const [book, setBook] = useState<BookDetail | null>(null);
  const [chapters, setChapters] = useState<ChapterListItem[]>([]);
  const [bookmarkChapter, setBookmarkChapter] = useState<number | null>(null);
  const [progress, setProgress] = useState<ProgressData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!reader) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    setError(false);
    fetch(`/api/books/${slug}?readerId=${reader.id}`)
      .then((res) => {
        if (!res.ok) throw new Error("failed to load book");
        return res.json();
      })
      .then((data: { book: BookDetail; chapters: ChapterListItem[]; bookmarkChapter: number | null }) => {
        setBook(data.book);
        setChapters(data.chapters);
        setBookmarkChapter(data.bookmarkChapter);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [slug, reader]);

  useEffect(() => {
    if (!reader || !bookmarkChapter) return;
    fetch(`/api/books/${slug}/progress?readerId=${reader.id}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((json: ProgressData | null) => setProgress(json))
      .catch(() => {
        // progress is a nice-to-have — a failed fetch just hides the card
      });
  }, [slug, reader, bookmarkChapter]);

  if (readerLoading) return null;
  if (!reader) return <ReaderGate />;
  if (loading) return <p className="text-sm text-[var(--ink-soft)]">{t("book.loading")}</p>;
  if (error || !book) return <p className="text-sm text-red-600 dark:text-red-400">{t("book.error")}</p>;

  const title = uiLang === "en" ? (book.titleEn ?? book.title) : book.title;
  const description = uiLang === "en" ? (book.descriptionEn ?? book.description) : book.description;

  return (
    <div className="flex flex-col gap-4">
      <Link href="/" className="flex items-center gap-1 self-start text-xs text-[var(--ink-soft)] hover:text-[var(--ink)]">
        <ChevronIcon direction="left" /> {t("nav.library")}
      </Link>

      <div>
        <h1 className="text-lg font-semibold text-[var(--ink)]">{title}</h1>
        {book.author && <p className="text-sm text-[var(--ink-soft)]">{book.author}</p>}
        {description && <p className="mt-2 text-sm leading-relaxed text-[var(--ink-soft)]">{description}</p>}
      </div>

      {progress?.started && <ProgressCard progress={progress} uiLang={uiLang} t={t} />}

      <Link
        href={`/book/${slug}/${bookmarkChapter ?? 1}`}
        className="self-start rounded-lg bg-[var(--clay-deep)] px-4 py-2 text-sm font-medium text-[var(--paper-raised)]"
      >
        {bookmarkChapter ? `${bookmarkChapter} ${t("book.resumeAt")}` : t("book.startFromOne")}
      </Link>

      <div className="grid grid-cols-5 gap-1.5 sm:grid-cols-6">
        {chapters.map((c) => (
          <Link
            key={c.id}
            href={`/book/${slug}/${c.chapterNumber}`}
            title={(uiLang === "en" ? c.titleEn : c.titleKo) ?? c.sourceTitle ?? undefined}
            className={`rounded-lg border py-2 text-center text-xs font-medium ${
              c.chapterNumber === bookmarkChapter
                ? "border-[var(--clay)] bg-[var(--clay-tint)] text-[var(--ink)]"
                : "border-[var(--line)] bg-[var(--paper-raised)] text-[var(--ink)] hover:border-[var(--clay)]"
            }`}
          >
            {c.chapterNumber}
          </Link>
        ))}
      </div>
    </div>
  );
}
