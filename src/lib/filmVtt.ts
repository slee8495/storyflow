import type { FilmCue } from "@/db/schema";

function stamp(sec: number): string {
  const ms = Math.max(0, Math.round(sec * 1000));
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  const pad = (n: number, w = 2) => String(n).padStart(w, "0");
  return `${pad(h)}:${pad(m)}:${pad(s)}.${pad(ms % 1000, 3)}`;
}

// A film's subtitle cues as WebVTT (same as Wordflow's). Inline, the app draws subtitles itself
// under the picture; this track is what the phone's own full-screen player shows, since nothing
// outside the <video> element survives going full screen.
export function cuesToVtt(cues: FilmCue[] | null | undefined): string {
  const body = (cues ?? [])
    .map((c) => `${stamp(c.start)} --> ${stamp(c.end + 0.25)}\n${c.text.replace(/-->/g, "→")}`)
    .join("\n\n");
  return `WEBVTT\n\n${body}\n`;
}

// The cue showing at playback time t. Held a beat past each cue's end so the subtitle doesn't
// blink out during the short pause between narrated sentences.
export function cueAt(cues: FilmCue[] | null | undefined, t: number): FilmCue | null {
  return cues?.find((c) => t >= c.start && t < c.end + 0.25) ?? null;
}
