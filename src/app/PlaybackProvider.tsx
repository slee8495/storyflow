"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { pauseSpeaking, prepareSpeech, resumeSpeaking, speak, stopSpeaking, type PreparedSpeech } from "@/lib/speak";

type SpeakState = "loading" | "playing" | "paused" | null;

// One thing to read aloud. A chapter's track knows how to save the listening position and which
// track comes after it, so narration carries on into the next chapter by itself (on every device —
// the phone app, a browser, the iPad) with a spoken "82장." in between.
export type Track = {
  id: string;
  label: string;
  text: string;
  startIndex?: number;
  // Spoken before the text, e.g. the chapter number when playback moved on to it by itself.
  intro?: string;
  // Called each time playback reaches a new chunk of the text.
  onPosition?: (chunkIndex: number) => void;
  // The track to play when this one finishes by itself, or null to stop there.
  next?: () => Promise<Track | null>;
};

type PlaybackContextValue = {
  // Identifies which piece of content is currently loaded/playing (e.g. "reading-passage" or
  // "today-context") — a page checks this against its own id to know whether ITS highlight
  // should track activeChunkIndex, since only one thing can play globally at a time.
  sourceId: string | null;
  label: string | null;
  speakState: SpeakState;
  activeChunkIndex: number | null;
  playText: (sourceId: string, label: string, text: string, startIndex?: number) => void;
  playTrack: (track: Track) => void;
  pause: () => void;
  resume: () => void;
  stop: () => void;
};

const PlaybackContext = createContext<PlaybackContextValue | null>(null);

export function PlaybackProvider({ children }: { children: React.ReactNode }) {
  const [sourceId, setSourceId] = useState<string | null>(null);
  const [label, setLabel] = useState<string | null>(null);
  const [speakState, setSpeakState] = useState<SpeakState>(null);
  const [activeChunkIndex, setActiveChunkIndex] = useState<number | null>(null);
  // Guards a stale playText() call's callbacks/cleanup from running after a newer call (or an
  // explicit stop()) has already taken over — same idea as speak.ts's own playToken, one level up.
  const genRef = useRef(0);
  // Mirrors speakState for resume() to read synchronously (see below) without needing speakState
  // in its dependency array — keeps pause/resume/stop identity-stable across renders, which
  // matters since they're re-registered with the Media Session API on every change (see the
  // effect below).
  const speakStateRef = useRef<SpeakState>(null);
  // eslint-disable-next-line react-hooks/refs -- deliberate: see comment above
  speakStateRef.current = speakState;

  const playTrack = useCallback(function play(track: Track, prepared?: PreparedSpeech | null) {
    const { id, label: lbl, text, startIndex } = track;
    if (!text.trim()) return;
    const gen = ++genRef.current;
    setSourceId(id);
    setLabel(lbl);
    setSpeakState("loading");
    setActiveChunkIndex(startIndex ?? null);

    // The next chapter is fetched and rendered while this one plays, so moving on is near-instant —
    // and, in the phone app with the screen off, needs only a hand-off rather than a long render
    // from a throttled background web view.
    let upcoming: Promise<{ track: Track; prepared: PreparedSpeech | null } | null> | null = null;
    const prepareUpcoming = () =>
      (upcoming ??= (track.next?.() ?? Promise.resolve(null))
        .then(async (nextTrack) =>
          nextTrack
            ? {
                track: nextTrack,
                prepared: await prepareSpeech(nextTrack.text, {
                  startIndex: nextTrack.startIndex,
                  intro: nextTrack.intro,
                }),
              }
            : null,
        )
        .catch(() => null));
    let lastPosition: number | null = null;

    speak(text, {
      onPlaybackStart: () => {
        if (genRef.current !== gen) return;
        setSpeakState((cur) => (cur ? "playing" : cur));
        prepareUpcoming();
      },
      onChunkStart: (index) => {
        if (genRef.current !== gen) return;
        setActiveChunkIndex(index);
        if (index !== lastPosition) {
          lastPosition = index;
          track.onPosition?.(index);
        }
      },
      startIndex,
      intro: track.intro,
      prepared,
      title: lbl,
      onExternalPause: () => {
        if (genRef.current !== gen) return;
        setSpeakState((cur) => (cur === "playing" ? "paused" : cur));
      },
      onExternalResume: () => {
        if (genRef.current !== gen) return;
        setSpeakState((cur) => (cur === "paused" ? "playing" : cur));
      },
    }).then(async (how) => {
      if (genRef.current !== gen) return; // superseded by a newer playTrack() or an explicit stop()
      if (how === "ended") {
        setSpeakState("loading");
        const up = await prepareUpcoming();
        if (genRef.current !== gen) return;
        if (up) {
          play(up.track, up.prepared);
          return;
        }
      }
      setSpeakState(null);
      setActiveChunkIndex(null);
      setSourceId(null);
      setLabel(null);
    });
  }, []);

  const playText = useCallback(
    (id: string, lbl: string, text: string, startIndex?: number) => playTrack({ id, label: lbl, text, startIndex }),
    [playTrack],
  );

  const pause = useCallback(() => {
    setSpeakState((cur) => {
      if (cur !== "playing") return cur;
      pauseSpeaking();
      return "paused";
    });
  }, []);

  const resume = useCallback(() => {
    if (speakStateRef.current !== "paused") return;
    const gen = ++genRef.current;
    setSpeakState("loading");
    resumeSpeaking().then((ok) => {
      if (genRef.current !== gen) return; // superseded by a newer action before this settled
      if (ok) {
        setSpeakState("playing");
        return;
      }
      // Couldn't actually resume — most likely the phone was locked/backgrounded long enough
      // that iOS discarded the audio session's buffered data (or a call/other audio interrupted
      // it). There's no cached buffer left to restart from, so reset to a clean not-playing
      // state instead of leaving the UI/lock-screen widget stuck showing "playing" with no
      // sound — the user has to reopen the passage and press play again either way.
      setSpeakState(null);
      setActiveChunkIndex(null);
      setSourceId(null);
      setLabel(null);
    });
  }, []);

  const stop = useCallback(() => {
    genRef.current++;
    stopSpeaking();
    setSpeakState(null);
    setActiveChunkIndex(null);
    setSourceId(null);
    setLabel(null);
  }, []);

  // Media Session integration serves two purposes: lock-screen/notification playback controls,
  // and — more importantly — signaling to the browser that this tab holds a real, ongoing media
  // session. Without it, mobile browsers treat a backgrounded tab's audio as non-essential and
  // block the next chunk's audio.play() call once the current clip ends, which is why playback
  // used to stop right at the sentence you were on when you switched apps instead of continuing.
  useEffect(() => {
    if (typeof navigator === "undefined" || !("mediaSession" in navigator)) return;
    if (!label) {
      navigator.mediaSession.metadata = null;
      navigator.mediaSession.playbackState = "none";
      return;
    }
    navigator.mediaSession.metadata = new MediaMetadata({ title: label, artist: "Storyflow" });
    navigator.mediaSession.playbackState = speakState === "paused" ? "paused" : "playing";
  }, [label, speakState]);

  // The iPhone app calls this when the Apple Watch starts narration on the phone natively
  // (ios/Storyflow/PhoneRemote.swift), so the two never talk over each other.
  useEffect(() => {
    window.__storyflowStopPlayback = stop;
    return () => {
      delete window.__storyflowStopPlayback;
    };
  }, [stop]);

  useEffect(() => {
    if (typeof navigator === "undefined" || !("mediaSession" in navigator)) return;
    navigator.mediaSession.setActionHandler("play", resume);
    navigator.mediaSession.setActionHandler("pause", pause);
    navigator.mediaSession.setActionHandler("stop", stop);
    return () => {
      navigator.mediaSession.setActionHandler("play", null);
      navigator.mediaSession.setActionHandler("pause", null);
      navigator.mediaSession.setActionHandler("stop", null);
    };
  }, [pause, resume, stop]);

  return (
    <PlaybackContext.Provider
      value={{ sourceId, label, speakState, activeChunkIndex, playText, playTrack, pause, resume, stop }}
    >
      {children}
    </PlaybackContext.Provider>
  );
}

export function usePlayback() {
  const ctx = useContext(PlaybackContext);
  if (!ctx) throw new Error("usePlayback must be used within PlaybackProvider");
  return ctx;
}
