"use client";

import { useEffect, useRef, useState } from "react";
import type { FilmCue } from "@/db/schema";
import { cueAt } from "@/lib/filmVtt";

export type Film = { videoUrl: string; posterUrl: string | null; cues: FilmCue[] | null; durationSec: number | null };

const RATES = [1, 1.25, 1.5];
const DEFAULT_RATE = 1.25;
const RATE_KEY = "storyflow.filmRate";

// "영상으로 보기" — ported from Wordflow's FilmPlayer: the film the Mac made for this chapter
// (photoreal scenes + the app's reading voice), with the Korean narration as a subtitle under the
// picture rather than burned in, a 1x / 1.25x / 1.5x pace (remembered per device), and a
// same-origin WebVTT track for full screen. Storyflow additions: the listening position is saved
// as the film plays (onChunk → bookmark, so 이어읽기 and the film loop know where the reader is),
// it starts from that position, and when it ends it offers the next chapter.
export function FilmPlayer({
  film,
  vttUrl,
  startChunk,
  onPlay,
  onChunk,
  onEnded,
  pause,
}: {
  film: Film;
  vttUrl: string;
  startChunk: number | null; // resume here (a splitIntoChunks index of the Korean text)
  onPlay: () => void; // stop the TTS reader so two voices never overlap
  onChunk: (chunkIndex: number) => void;
  onEnded: () => void;
  pause: boolean; // true while the TTS reader is playing — the film yields to it
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [cue, setCue] = useState<string | null>(null);
  const [rate, setRate] = useState(DEFAULT_RATE);
  const lastChunk = useRef<number | null>(null);

  useEffect(() => {
    try {
      const saved = Number(localStorage.getItem(RATE_KEY));
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (RATES.includes(saved)) setRate(saved);
    } catch {
      // storage blocked — keep the default pace
    }
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.defaultPlaybackRate = rate;
    video.playbackRate = rate;
  }, [rate, film.videoUrl]);

  useEffect(() => {
    if (pause) videoRef.current?.pause();
  }, [pause]);

  function chooseRate(next: number) {
    setRate(next);
    try {
      localStorage.setItem(RATE_KEY, String(next));
    } catch {
      // storage blocked — the pace just won't be remembered
    }
  }

  // Inline, subtitles are drawn below the picture, so the <track> stays hidden. Full screen shows
  // only the video element itself (on iPhone, the native player), so the track is switched on then.
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const setShowing = (showing: boolean) => {
      for (const track of Array.from(video.textTracks)) track.mode = showing ? "showing" : "hidden";
    };
    const onDocFullscreen = () => {
      const el = document.fullscreenElement ?? (document as { webkitFullscreenElement?: Element }).webkitFullscreenElement;
      setShowing(!!el && (el === video || el.contains(video)));
    };
    const onBegin = () => setShowing(true);
    const onEnd = () => setShowing(false);
    const onTrackAdded = () => setShowing(false);
    setShowing(false);
    video.textTracks.addEventListener?.("addtrack", onTrackAdded);
    video.addEventListener("webkitbeginfullscreen", onBegin);
    video.addEventListener("webkitendfullscreen", onEnd);
    document.addEventListener("fullscreenchange", onDocFullscreen);
    document.addEventListener("webkitfullscreenchange", onDocFullscreen);
    return () => {
      video.textTracks.removeEventListener?.("addtrack", onTrackAdded);
      video.removeEventListener("webkitbeginfullscreen", onBegin);
      video.removeEventListener("webkitendfullscreen", onEnd);
      document.removeEventListener("fullscreenchange", onDocFullscreen);
      document.removeEventListener("webkitfullscreenchange", onDocFullscreen);
    };
  }, [vttUrl]);

  function onTime() {
    const c = cueAt(film.cues, videoRef.current?.currentTime ?? 0);
    setCue(c?.text ?? null);
    if (c && c.chunk >= 0 && c.chunk !== lastChunk.current) {
      lastChunk.current = c.chunk;
      onChunk(c.chunk);
    }
  }

  return (
    <section className="-mx-4 mb-3 overflow-hidden bg-black sm:mx-0 sm:rounded-xl">
      <video
        ref={videoRef}
        src={film.videoUrl}
        poster={film.posterUrl ?? undefined}
        controls
        playsInline
        preload="metadata"
        onPlay={onPlay}
        onLoadedMetadata={(e) => {
          const video = e.currentTarget;
          // A fresh source resets playbackRate to defaultPlaybackRate on some browsers; reassert.
          video.playbackRate = rate;
          if (startChunk !== null && startChunk > 0 && video.currentTime < 1) {
            const at = film.cues?.find((c) => c.chunk === startChunk);
            if (at) video.currentTime = Math.max(0, at.start - 0.5);
          }
        }}
        onTimeUpdate={onTime}
        onSeeked={onTime}
        onEnded={onEnded}
        className="aspect-[7/4] w-full bg-black"
      >
        <track kind="subtitles" src={vttUrl} srcLang="ko" label="한국어" default />
      </video>
      <div className="flex min-h-[5.5rem] items-center justify-center px-4 py-3 text-center">
        <p className="text-base leading-relaxed text-[#ece4d2]">{cue ?? " "}</p>
      </div>
      <div className="flex items-center justify-end gap-1 px-3 pb-2">
        <span className="mr-1 text-xs text-[#ece4d2] opacity-60">읽는 속도</span>
        {RATES.map((r) => (
          <button
            key={r}
            onClick={() => chooseRate(r)}
            className={`rounded-full px-2.5 py-1 text-xs ${
              rate === r ? "bg-[#ece4d2] font-semibold text-black" : "text-[#ece4d2] opacity-70 hover:opacity-100"
            }`}
          >
            {r}x
          </button>
        ))}
      </div>
    </section>
  );
}
