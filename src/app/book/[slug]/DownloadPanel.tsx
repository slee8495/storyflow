"use client";

import { useEffect, useState } from "react";
import { bookBytes, formatBytes, type Lang } from "@/lib/offline";
import { useOffline } from "../../OfflineProvider";
import { useUiLanguage } from "../../UiLanguageProvider";

const CONTENT_LANG_KEY = "storyflow:lang"; // the chapter page's story-language toggle
const AUDIO_COUNTS = [0, 3, 5, 10] as const;
// "rest": from the chapter being read to the end of the book; "all": every chapter.
type AudioCount = (typeof AUDIO_COUNTS)[number] | "rest" | "all";

export function DownloadPanel({
  slug,
  title,
  chapterNumbers,
  startChapter,
  readerId,
}: {
  slug: string;
  title: string;
  chapterNumbers: number[];
  startChapter: number;
  readerId: number;
}) {
  const { supported, online, manifest, job, startDownload, cancelDownload, clearJob } = useOffline();
  const { t } = useUiLanguage();
  const [open, setOpen] = useState(false);
  const [wholeText, setWholeText] = useState(true);
  const [audioCount, setAudioCount] = useState<AudioCount>(5);
  const [audioLang, setAudioLang] = useState<Lang | "both">("en");

  useEffect(() => {
    try {
      const stored = localStorage.getItem(CONTENT_LANG_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (stored === "ko" || stored === "en") setAudioLang(stored);
    } catch {}
  }, []);

  const saved = manifest.books[slug];
  const savedEntries = Object.values(saved?.chapters ?? {});
  const textCount = savedEntries.filter((c) => c.text).length;
  const audioCountSaved = savedEntries.filter((c) => c.audio.length > 0).length;
  const myJob = job?.slug === slug ? job : null;
  const running = myJob?.status === "running";

  function start() {
    const langs: Lang[] = audioLang === "both" ? ["ko", "en"] : [audioLang];
    const fromStart = chapterNumbers.filter((n) => n >= startChapter);
    const audioWanted =
      audioCount === "all" ? chapterNumbers : audioCount === "rest" ? fromStart : fromStart.slice(0, audioCount);
    // Skip what's already saved, so pressing Download again only fetches what's missing.
    const audioChapters = audioWanted.filter((n) => langs.some((l) => !saved?.chapters[n]?.audio.includes(l)));
    const textChapters = (wholeText ? chapterNumbers : []).filter((n) => !saved?.chapters[n]?.text);
    startDownload({ slug, title, readerId, textChapters, audioChapters, audioLangs: langs });
  }

  const pill = (active: boolean) =>
    `rounded-full px-3 py-1 text-xs font-medium ${
      active ? "bg-[var(--paper-raised)] text-[var(--ink)] shadow-sm" : "text-[var(--ink-soft)]"
    }`;

  return (
    <section className="flex flex-col gap-3 rounded-xl border border-[var(--line)] bg-[var(--paper-raised)] p-4 shadow-sm">
      <button onClick={() => setOpen((o) => !o)} className="flex items-center justify-between text-left">
        <span className="text-sm font-semibold text-[var(--ink-soft)]">⬇︎ {t("offline.title")}</span>
        {saved && (
          <span className="text-xs text-[var(--ink-soft)]">
            {t("offline.textChapters")} {textCount} · {t("offline.audioChapters")} {audioCountSaved} {t("offline.chaptersUnit")} ·{" "}
            {formatBytes(bookBytes(saved))}
          </span>
        )}
      </button>

      {open && !supported && <p className="text-xs text-[var(--ink-soft)]">{t("offline.unsupported")}</p>}

      {open && supported && !running && (
        <div className="flex flex-col gap-3">
          <label className="flex items-center gap-2 text-sm text-[var(--ink)]">
            <input type="checkbox" checked={wholeText} onChange={(e) => setWholeText(e.target.checked)} />
            {t("offline.optText")}
          </label>

          <div className="flex flex-col gap-1.5">
            <span className="text-sm text-[var(--ink)]">{t("offline.optAudio")}</span>
            <div className="flex w-fit flex-wrap gap-1 rounded-full bg-[var(--clay-tint)] p-0.5">
              {AUDIO_COUNTS.map((n) => (
                <button key={n} onClick={() => setAudioCount(n)} className={pill(audioCount === n)}>
                  {n === 0 ? t("offline.audioNone") : `${t("offline.audioNext")} ${n}`}
                </button>
              ))}
              <button onClick={() => setAudioCount("rest")} className={pill(audioCount === "rest")}>
                {t("offline.audioRest")}
              </button>
              <button onClick={() => setAudioCount("all")} className={pill(audioCount === "all")}>
                {t("offline.audioAll")}
              </button>
            </div>
            {audioCount !== 0 && audioCount !== "all" && (
              <span className="text-xs text-[var(--ink-soft)]">
                {t("offline.audioFrom").replace("{n}", String(startChapter))}
              </span>
            )}
          </div>

          {audioCount !== 0 && (
            <div className="flex flex-col gap-1.5">
              <span className="text-sm text-[var(--ink)]">{t("offline.audioLang")}</span>
              <div className="flex w-fit gap-1 rounded-full bg-[var(--clay-tint)] p-0.5">
                <button onClick={() => setAudioLang("ko")} className={pill(audioLang === "ko")}>
                  한국어
                </button>
                <button onClick={() => setAudioLang("en")} className={pill(audioLang === "en")}>
                  English
                </button>
                <button onClick={() => setAudioLang("both")} className={pill(audioLang === "both")}>
                  {t("offline.both")}
                </button>
              </div>
            </div>
          )}

          <button
            onClick={start}
            disabled={!online || (!wholeText && audioCount === 0)}
            className="self-start rounded-lg bg-[var(--clay-deep)] px-4 py-2 text-sm font-medium text-[var(--paper-raised)] disabled:opacity-50"
          >
            {t("offline.start")}
          </button>
          <p className="text-xs text-[var(--ink-soft)]">{t("offline.keepOpen")}</p>
        </div>
      )}

      {myJob && (open || running) && <JobStatus job={myJob} onCancel={cancelDownload} onDismiss={clearJob} />}
    </section>
  );
}

function JobStatus({
  job,
  onCancel,
  onDismiss,
}: {
  job: NonNullable<ReturnType<typeof useOffline>["job"]>;
  onCancel: () => void;
  onDismiss: () => void;
}) {
  const { t } = useUiLanguage();
  const p = job.progress;
  const bar = (done: number, total: number) => (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--clay-tint)]">
      <div className="h-full rounded-full bg-[var(--clay)]" style={{ width: `${total ? (done / total) * 100 : 0}%` }} />
    </div>
  );

  if (job.status !== "running") {
    const message =
      job.status === "cancelled"
        ? t("offline.cancelled")
        : job.status === "error"
          ? t("offline.error")
          : p.failed > 0
            ? t("offline.doneWithFailures")
            : t("offline.done");
    return (
      <div className="flex items-center justify-between gap-2 rounded-lg bg-[var(--clay-tint)] px-3 py-2 text-xs text-[var(--ink)]">
        <span>{message}</span>
        <button onClick={onDismiss} className="shrink-0 text-[var(--ink-soft)]">
          ✕
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {p.textTotal > 0 && (
        <div className="flex flex-col gap-1">
          <span className="text-xs text-[var(--ink-soft)]">
            {t("offline.progressText")} {p.textDone}/{p.textTotal}
          </span>
          {bar(p.textDone, p.textTotal)}
        </div>
      )}
      {p.audioTotal > 0 && (
        <div className="flex flex-col gap-1">
          <span className="text-xs text-[var(--ink-soft)]">
            {t("offline.progressAudio")} {p.audioDone}/{p.audioTotal}
            {p.audioChunkTotal > 0 && p.audioDone < p.audioTotal ? ` (${p.audioChunkDone}/${p.audioChunkTotal})` : ""}
          </span>
          {bar(p.audioDone + (p.audioChunkTotal ? p.audioChunkDone / p.audioChunkTotal : 0), p.audioTotal)}
        </div>
      )}
      <button onClick={onCancel} className="self-start text-xs text-[var(--ink-soft)] underline">
        {t("offline.cancel")}
      </button>
    </div>
  );
}
