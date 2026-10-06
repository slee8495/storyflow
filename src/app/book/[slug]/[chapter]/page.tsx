"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { splitIntoChunks } from "@/lib/speak";
import { ReaderGate, useReader } from "../../../ReaderProvider";
import { ChevronIcon } from "../../../ChevronIcon";
import { usePlayback } from "../../../PlaybackProvider";
import { useUiLanguage } from "../../../UiLanguageProvider";

const LANG_KEY = "storyflow:lang";
const RESUME_MARKER_ID = "resume-marker";
const sourceId = (slug: string, chapterNumber: number) => `chapter-${slug}-${chapterNumber}`;

type ChapterData = {
  chapterNumber: number;
  sourceTitle: string | null;
  titleKo: string | null;
  titleEn: string | null;
  storyKo: string | null;
  storyEn: string | null;
};

type Illustration = {
  id: number;
  imageUrl: string;
  title: string;
  artist: string;
  dateDisplay: string | null;
  credit: string;
  sourceUrl: string;
  captionKo: string;
  captionEn: string;
};

type ResumePosition = { chunkIndex: number; lang: "ko" | "en" };

type ChapterResponse = {
  book: { id: number; slug: string; title: string; totalChapters: number | null };
  chapter: ChapterData;
  illustrations: Illustration[];
  hasPrev: boolean;
  hasNext: boolean;
  resume: ResumePosition | null;
};

// Public-domain museum artwork paired with the chapter (see schema.ts chapterIllustrations).
// Rendered outside HighlightedText so it never shifts TTS chunk indices. Tapping the image opens
// the museum's own page for the full-resolution version and object details.
function IllustrationFigure({ illustration, lang }: { illustration: Illustration; lang: "ko" | "en" }) {
  return (
    <figure className="mb-4 flex flex-col gap-2">
      <a href={illustration.sourceUrl} target="_blank" rel="noopener noreferrer">
        {/* Plain <img>: hotlinked museum IIIF/CDN images, already web-sized — no need for next/image optimization. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={illustration.imageUrl}
          alt={`${illustration.title} — ${illustration.artist}`}
          loading="lazy"
          className="max-h-[70vh] w-full rounded-lg bg-[var(--clay-tint)] object-contain"
        />
      </a>
      <figcaption className="flex flex-col gap-1 text-xs text-[var(--ink-soft)]">
        <span className="text-sm text-[var(--ink)]">{lang === "en" ? illustration.captionEn : illustration.captionKo}</span>
        <span>
          <em>{illustration.title}</em> · {illustration.artist}
          {illustration.dateDisplay ? `, ${illustration.dateDisplay}` : ""} · {illustration.credit}
        </span>
      </figcaption>
    </figure>
  );
}

function HighlightedText({
  text,
  isActiveSection,
  activeChunkIndex,
  markerIndex,
  onSentenceClick,
}: {
  text: string;
  isActiveSection: boolean;
  activeChunkIndex: number | null;
  markerIndex: number | null;
  onSentenceClick: (index: number) => void;
}) {
  const chunks = splitIntoChunks(text);
  return (
    <p className="text-base leading-relaxed whitespace-pre-line">
      {chunks.map((chunk, i) => {
        const isPlayingHere = isActiveSection && i === activeChunkIndex;
        const isMarked = !isActiveSection && i === markerIndex;
        return (
          <span
            key={i}
            id={isMarked ? RESUME_MARKER_ID : undefined}
            role="button"
            tabIndex={0}
            onClick={() => onSentenceClick(i)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onSentenceClick(i);
              }
            }}
            className={
              isPlayingHere
                ? "cursor-pointer rounded bg-[var(--clay-deep)] font-semibold text-[var(--paper-raised)] transition-colors"
                : isMarked
                  ? "cursor-pointer rounded border-b-2 border-[var(--clay)] bg-[var(--clay-tint)] transition-colors"
                  : "cursor-pointer transition-colors hover:bg-[var(--clay-tint)]"
            }
          >
            {chunk}
            {i < chunks.length - 1 ? " " : ""}
          </span>
        );
      })}
    </p>
  );
}

export default function ChapterPage() {
  const { slug, chapter: chapterParam } = useParams<{ slug: string; chapter: string }>();
  const chapterNumber = Number(chapterParam);
  const { reader, loading: readerLoading } = useReader();
  const { sourceId: playingSourceId, speakState, activeChunkIndex, playText, pause, resume, stop } = usePlayback();
  const { t } = useUiLanguage();

  const [data, setData] = useState<ChapterResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState(false);
  const [lang, setLang] = useState<"ko" | "en">("en");
  // The reader's saved in-chapter sentence position for THIS chapter, from the API response.
  // Only ever set once, on load — not touched by live playback (activeChunkIndex from
  // PlaybackProvider is the live position once playing; this is just where to resume from before
  // that starts, and where to scroll/mark on arrival).
  const [resumePosition, setResumePosition] = useState<ResumePosition | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem(LANG_KEY);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (stored === "en" || stored === "ko") setLang(stored);
  }, []);

  useEffect(() => {
    if (!reader || !Number.isInteger(chapterNumber)) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    setGenerating(false);
    setError(false);
    setResumePosition(null);
    // A never-before-read chapter takes a few seconds to generate (see /api/books/[slug]/
    // chapters/[chapterNumber]) — flip a slower-feeling message on after a short delay instead of
    // always showing "불러오는 중" for what's usually an instant cached fetch.
    const generatingTimer = setTimeout(() => setGenerating(true), 800);
    fetch(`/api/books/${slug}/chapters/${chapterNumber}?readerId=${reader.id}`)
      .then((res) => {
        if (!res.ok) throw new Error("failed to load chapter");
        return res.json();
      })
      .then((json: ChapterResponse) => {
        setData(json);
        if (json.resume) {
          setResumePosition(json.resume);
          // Land the reader on the language they left off in, not whatever this device's last
          // global toggle was — a chunkIndex only makes sense paired with its own language's text.
          setLang(json.resume.lang);
        }
      })
      .catch(() => setError(true))
      .finally(() => {
        clearTimeout(generatingTimer);
        setLoading(false);
        setGenerating(false);
      });
    return () => clearTimeout(generatingTimer);
  }, [slug, chapterNumber, reader]);

  // Scrolls the resume marker into view once the chapter's text has actually rendered.
  useEffect(() => {
    if (!resumePosition) return;
    const el = document.getElementById(RESUME_MARKER_ID);
    el?.scrollIntoView({ block: "center" });
  }, [resumePosition]);

  useEffect(() => {
    if (!reader || !data) return;
    fetch("/api/bookmarks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ readerId: reader.id, bookId: data.book.id, chapterNumber }),
    }).catch(() => {
      // best-effort — a failed bookmark save shouldn't block reading
    });
  }, [reader, data, chapterNumber]);

  const thisSourceId = sourceId(slug, chapterNumber);
  const isSpeakingThis = playingSourceId === thisSourceId;

  // Saves the sentence position as playback (TTS or click-to-seek, both drive activeChunkIndex)
  // advances through THIS chapter — the whole point being able to pick back up mid-chapter later.
  useEffect(() => {
    if (!reader || !data || !isSpeakingThis || activeChunkIndex === null) return;
    fetch("/api/bookmarks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ readerId: reader.id, bookId: data.book.id, chapterNumber, chunkIndex: activeChunkIndex, lang }),
    }).catch(() => {
      // best-effort
    });
  }, [reader, data, chapterNumber, isSpeakingThis, activeChunkIndex, lang]);

  const chunks = useMemo(() => {
    if (!data) return [];
    const text = lang === "en" ? data.chapter.storyEn : data.chapter.storyKo;
    return text ? splitIntoChunks(text) : [];
  }, [data, lang]);

  function setLanguage(next: "ko" | "en") {
    setLang(next);
    localStorage.setItem(LANG_KEY, next);
  }

  function speak(startIndex?: number) {
    if (!data) return;
    const text = lang === "en" ? data.chapter.storyEn : data.chapter.storyKo;
    const title = lang === "en" ? data.chapter.titleEn : data.chapter.titleKo;
    if (!text?.trim()) return;
    playText(thisSourceId, title ?? `Ch. ${chapterNumber}`, text, startIndex);
  }

  const markerIndex = resumePosition && resumePosition.lang === lang ? resumePosition.chunkIndex : null;

  if (readerLoading) return null;
  if (!reader) return <ReaderGate />;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <Link
          href={`/book/${slug}`}
          className="flex items-center gap-1 text-xs text-[var(--ink-soft)] hover:text-[var(--ink)]"
        >
          <ChevronIcon direction="left" /> {t("nav.tableOfContents")}
        </Link>
        <div className="flex gap-1 rounded-full bg-[var(--clay-tint)] p-0.5 text-xs">
          <button
            onClick={() => setLanguage("ko")}
            className={`rounded-full px-2 py-1 ${
              lang === "ko" ? "bg-[var(--paper-raised)] text-[var(--ink)] shadow-sm" : "text-[var(--ink-soft)]"
            }`}
          >
            {t("chapter.korean")}
          </button>
          <button
            onClick={() => setLanguage("en")}
            className={`rounded-full px-2 py-1 ${
              lang === "en" ? "bg-[var(--paper-raised)] text-[var(--ink)] shadow-sm" : "text-[var(--ink-soft)]"
            }`}
          >
            {t("chapter.english")}
          </button>
        </div>
      </div>

      {loading && (
        <p className="text-sm text-[var(--ink-soft)]">
          {generating ? t("chapter.generating") : t("chapter.loading")}
        </p>
      )}
      {error && <p className="text-sm text-red-600 dark:text-red-400">{t("chapter.error")}</p>}

      {data && (
        <>
          <section className="rounded-xl border border-[var(--line)] bg-[var(--paper-raised)] p-4 shadow-sm">
            <div className="mb-2 flex items-center justify-between gap-2">
              <h1 className="text-lg font-semibold text-[var(--ink)]">
                Ch. {chapterNumber} · {lang === "en" ? data.chapter.titleEn : data.chapter.titleKo}
              </h1>
              {!isSpeakingThis ? (
                <button
                  onClick={() => speak(markerIndex ?? undefined)}
                  className="shrink-0 text-lg"
                  aria-label={t("chapter.listen")}
                >
                  🔊
                </button>
              ) : (
                <div className="flex shrink-0 items-center gap-2">
                  <button
                    onClick={() => (speakState === "paused" ? resume() : pause())}
                    disabled={speakState === "loading"}
                    className="text-lg disabled:opacity-50"
                    aria-label={speakState === "paused" ? t("playback.resume") : t("playback.pause")}
                  >
                    {speakState === "loading" ? "…" : speakState === "paused" ? "▶️" : "⏸️"}
                  </button>
                  <button onClick={stop} className="text-lg" aria-label={t("playback.stop")}>
                    ⏹️
                  </button>
                </div>
              )}
            </div>
            {data.illustrations.map((illustration) => (
              <IllustrationFigure key={illustration.id} illustration={illustration} lang={lang} />
            ))}
            {markerIndex !== null && !isSpeakingThis && (
              <p className="mb-2 text-xs text-[var(--ink-soft)]">🔖 {t("chapter.resumeHint")}</p>
            )}
            {chunks.length > 0 ? (
              <HighlightedText
                text={lang === "en" ? data.chapter.storyEn! : data.chapter.storyKo!}
                isActiveSection={isSpeakingThis}
                activeChunkIndex={activeChunkIndex}
                markerIndex={markerIndex}
                onSentenceClick={(i) => speak(i)}
              />
            ) : (
              <p className="text-sm text-[var(--ink-soft)]">{t("chapter.empty")}</p>
            )}
          </section>

          <div className="flex items-center justify-between rounded-xl border border-[var(--line)] bg-[var(--paper-raised)] px-3 py-2">
            <Link
              href={data.hasPrev ? `/book/${slug}/${chapterNumber - 1}` : "#"}
              aria-disabled={!data.hasPrev}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium text-[var(--ink)] hover:bg-[var(--clay-tint)] ${
                !data.hasPrev ? "pointer-events-none opacity-30" : ""
              }`}
            >
              <ChevronIcon direction="left" className="mr-1" /> {t("chapter.prev")}
            </Link>
            <Link
              href={data.hasNext ? `/book/${slug}/${chapterNumber + 1}` : "#"}
              aria-disabled={!data.hasNext}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium text-[var(--ink)] hover:bg-[var(--clay-tint)] ${
                !data.hasNext ? "pointer-events-none opacity-30" : ""
              }`}
            >
              {t("chapter.next")} <ChevronIcon direction="right" className="ml-1" />
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
