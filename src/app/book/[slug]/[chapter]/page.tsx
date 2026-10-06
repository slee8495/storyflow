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

type SavedMark = {
  id: number;
  chapterNumber: number;
  chunkIndex: number | null;
  lang: "ko" | "en" | null;
  excerpt: string;
  note: string | null;
};

type ResumePosition = { chunkIndex: number; lang: "ko" | "en" };

type ChapterResponse = {
  book: { id: number; slug: string; title: string; totalChapters: number | null };
  chapter: ChapterData;
  illustrations: Illustration[];
  marks: SavedMark[];
  hasPrev: boolean;
  hasNext: boolean;
  resume: ResumePosition | null;
};

// Public-domain museum artwork paired with the chapter (see schema.ts chapterIllustrations).
// Rendered outside HighlightedText so it never shifts TTS chunk indices. Tapping the image opens
// the museum's own page for the full-resolution version and object details.
// The images stay pinned under the site header while the reader scrolls through the chapter text
// (sticky within the chapter card, so they release once the card ends). Height is capped so the
// text below keeps most of the screen; the long captions scroll normally underneath.
function IllustrationPanel({ illustrations, lang }: { illustrations: Illustration[]; lang: "ko" | "en" }) {
  const headerHeight = useHeaderHeight();
  if (illustrations.length === 0) return null;
  return (
    <>
      <div
        className="sticky z-[5] -mx-4 mb-3 border-b border-[var(--line)] bg-[var(--paper-raised)] px-4 py-2"
        style={{ top: headerHeight }}
      >
        <div className={`grid gap-2 ${illustrations.length > 1 ? "grid-cols-2" : "grid-cols-1"}`}>
          {illustrations.map((illustration) => (
            <a key={illustration.id} href={illustration.sourceUrl} target="_blank" rel="noopener noreferrer">
              {/* Plain <img>: hotlinked museum IIIF/CDN images, already web-sized — no need for next/image optimization. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={illustration.imageUrl}
                alt={`${illustration.title} — ${illustration.artist}`}
                className="max-h-[32vh] w-full rounded-lg bg-[var(--clay-tint)] object-contain"
              />
            </a>
          ))}
        </div>
      </div>
      {illustrations.map((illustration) => (
        <figure key={illustration.id} className="mb-4">
          <figcaption className="flex flex-col gap-1 text-xs text-[var(--ink-soft)]">
            <span className="text-sm text-[var(--ink)]">{lang === "en" ? illustration.captionEn : illustration.captionKo}</span>
            <span>
              <em>{illustration.title}</em> · {illustration.artist}
              {illustration.dateDisplay ? `, ${illustration.dateDisplay}` : ""} · {illustration.credit}
            </span>
          </figcaption>
        </figure>
      ))}
    </>
  );
}

// Height of the layout's sticky site header (safe-area inset + font-scaled title), so the pinned
// illustrations sit just below it instead of underneath it.
function useHeaderHeight() {
  const [height, setHeight] = useState(0);
  useEffect(() => {
    const header = document.querySelector("body header");
    if (!header) return;
    const update = () => setHeight(header.getBoundingClientRect().height);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(header);
    return () => observer.disconnect();
  }, []);
  return height;
}

function HighlightedText({
  text,
  isActiveSection,
  activeChunkIndex,
  markerIndex,
  savedIndices,
  onSentenceClick,
}: {
  text: string;
  isActiveSection: boolean;
  activeChunkIndex: number | null;
  markerIndex: number | null;
  savedIndices: Set<number>;
  onSentenceClick: (index: number) => void;
}) {
  const chunks = splitIntoChunks(text);
  return (
    <p className="text-base leading-relaxed whitespace-pre-line">
      {chunks.map((chunk, i) => {
        const isPlayingHere = isActiveSection && i === activeChunkIndex;
        const isMarked = !isActiveSection && i === markerIndex;
        const isSaved = savedIndices.has(i);
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
            className={`${
              isPlayingHere
                ? "cursor-pointer rounded bg-[var(--clay-deep)] font-semibold text-[var(--paper-raised)] transition-colors"
                : isMarked
                  ? "cursor-pointer rounded border-b-2 border-[var(--clay)] bg-[var(--clay-tint)] transition-colors"
                  : "cursor-pointer transition-colors hover:bg-[var(--clay-tint)]"
            }${isSaved ? " underline decoration-[var(--clay)] decoration-2 underline-offset-4" : ""}`}
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
  // Hand-placed bookmarks in this chapter (see schema.ts savedMarks). While markMode is on,
  // tapping a sentence toggles a bookmark on it instead of starting playback from it.
  const [marks, setMarks] = useState<SavedMark[]>([]);
  const [markMode, setMarkMode] = useState(false);
  // True when the page was opened from the book page's bookmark list (?at=&lang=) — the marked
  // sentence is then that bookmark, not the automatic resume point.
  const [openedFromMark, setOpenedFromMark] = useState(false);

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
    setMarks([]);
    setMarkMode(false);
    setOpenedFromMark(false);
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
        setMarks(json.marks);
        const query = new URLSearchParams(window.location.search);
        const at = Number(query.get("at"));
        const atLang = query.get("lang");
        if (query.has("at") && Number.isInteger(at) && (atLang === "ko" || atLang === "en")) {
          setResumePosition({ chunkIndex: at, lang: atLang });
          setLang(atLang);
          setOpenedFromMark(true);
        } else if (json.resume) {
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

  const savedIndices = useMemo(
    () => new Set(marks.filter((m) => m.lang === lang && m.chunkIndex !== null).map((m) => m.chunkIndex!)),
    [marks, lang],
  );
  const chapterMark = marks.find((m) => m.chunkIndex === null);

  async function addMark(body: { chunkIndex?: number; lang?: "ko" | "en"; excerpt: string }) {
    if (!reader) return;
    const res = await fetch(`/api/books/${slug}/marks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ readerId: reader.id, chapterNumber, ...body }),
    });
    if (!res.ok) return;
    const { mark } = (await res.json()) as { mark: SavedMark };
    setMarks((prev) => (prev.some((m) => m.id === mark.id) ? prev : [...prev, mark]));
  }

  async function removeMark(id: number) {
    if (!reader) return;
    setMarks((prev) => prev.filter((m) => m.id !== id));
    await fetch(`/api/books/${slug}/marks?readerId=${reader.id}&id=${id}`, { method: "DELETE" }).catch(() => {});
  }

  function toggleSentenceMark(index: number) {
    const existing = marks.find((m) => m.lang === lang && m.chunkIndex === index);
    if (existing) removeMark(existing.id);
    else if (chunks[index]) addMark({ chunkIndex: index, lang, excerpt: chunks[index] });
  }

  function toggleChapterMark() {
    if (!data) return;
    if (chapterMark) removeMark(chapterMark.id);
    else addMark({ excerpt: (lang === "en" ? data.chapter.titleEn : data.chapter.titleKo) ?? `Ch. ${chapterNumber}` });
  }

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
              <div className="flex shrink-0 items-center gap-2">
                <button
                  onClick={() => setMarkMode((on) => !on)}
                  aria-pressed={markMode}
                  aria-label={t("marks.toggleMode")}
                  className={`rounded-full px-1.5 text-lg ${markMode ? "bg-[var(--clay-tint)] ring-2 ring-[var(--clay)]" : ""}`}
                >
                  🔖
                </button>
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
            </div>
            {markMode && (
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-[var(--clay-tint)] px-3 py-2 text-xs text-[var(--ink)]">
                <span>{t("marks.modeHint")}</span>
                <button
                  onClick={toggleChapterMark}
                  className="rounded-full border border-[var(--clay)] px-2 py-1 font-medium"
                >
                  {chapterMark ? `✓ ${t("marks.chapterSaved")}` : `+ ${t("marks.saveChapter")}`}
                </button>
              </div>
            )}
            <IllustrationPanel illustrations={data.illustrations} lang={lang} />
            {markerIndex !== null && !isSpeakingThis && (
              <p className="mb-2 text-xs text-[var(--ink-soft)]">
                🔖 {openedFromMark ? t("marks.jumpHint") : t("chapter.resumeHint")}
              </p>
            )}
            {chunks.length > 0 ? (
              <HighlightedText
                text={lang === "en" ? data.chapter.storyEn! : data.chapter.storyKo!}
                isActiveSection={isSpeakingThis}
                activeChunkIndex={activeChunkIndex}
                markerIndex={markerIndex}
                savedIndices={savedIndices}
                onSentenceClick={(i) => (markMode ? toggleSentenceMark(i) : speak(i))}
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
