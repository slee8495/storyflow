// Bridge to the iPhone app's native player (ios/Storyflow/NativeAudio.swift). Inside the app's
// WKWebView, an <audio> element's data is fed from the web content process, which iOS throttles
// while the app is in the background — exactly the state it's in during CarPlay, where playback
// crackled and stuttered (fine on the phone with the screen on). Handing the finished WAV to the
// app once and letting AVAudioPlayer play it from memory takes the web view out of the loop.
//
// NativeAudio mimics the slice of HTMLAudioElement that speak.ts uses (currentTime, paused,
// play/pause, and the playing/pause/timeupdate/ended/error events), so speak.ts can drive either.
// In a plain browser, or an older app build without the handler, nativeAudioAvailable() is false
// and speak.ts keeps using <audio>.

type AudioMessage =
  | { type: "begin" }
  | { type: "data"; b64: string }
  | { type: "play"; title: string }
  | { type: "pause" }
  | { type: "resume" }
  | { type: "stop" };

declare global {
  interface Window {
    webkit?: { messageHandlers?: { storyflowAudio?: { postMessage(message: AudioMessage): void } } };
    __storyflowNativeAudio?: (event: string, value?: number) => void;
  }
}

// Base64 slices sent per message — keeps each bridge string a few MB instead of one 50MB+ string
// for a long chapter.
const SLICE_BYTES = 3 * 1024 * 1024;
// How long play() waits for the app to confirm before treating the resume as failed.
const PLAY_CONFIRM_MS = 2000;

export function nativeAudioAvailable(): boolean {
  return typeof window !== "undefined" && !!window.webkit?.messageHandlers?.storyflowAudio;
}

function post(message: AudioMessage) {
  window.webkit?.messageHandlers?.storyflowAudio?.postMessage(message);
}

function base64Of(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",", 2)[1] ?? "");
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

export class NativeAudio extends EventTarget {
  currentTime = 0;
  paused = true;

  constructor() {
    super();
    window.__storyflowNativeAudio = (event, value) => {
      if (event === "time") {
        this.currentTime = value ?? this.currentTime;
        this.dispatchEvent(new Event("timeupdate"));
        return;
      }
      if (event === "playing") this.paused = false;
      if (event === "pause" || event === "ended" || event === "error") this.paused = true;
      this.dispatchEvent(new Event(event));
    };
  }

  // Ships the whole file to the app and starts it. Resolves once sent; the app reports back
  // with a "playing" (or "error") event.
  async load(blob: Blob, title: string) {
    this.currentTime = 0;
    this.paused = true;
    post({ type: "begin" });
    for (let start = 0; start < blob.size; start += SLICE_BYTES) {
      post({ type: "data", b64: await base64Of(blob.slice(start, start + SLICE_BYTES)) });
    }
    post({ type: "play", title });
  }

  // Same contract as HTMLMediaElement.play(): resolves once playback has actually resumed,
  // rejects if the app reports an error or never confirms.
  play(): Promise<void> {
    return new Promise((resolve, reject) => {
      const done = (ok: boolean) => {
        clearTimeout(timer);
        this.removeEventListener("playing", onPlaying);
        this.removeEventListener("error", onError);
        if (ok) resolve();
        else reject(new Error("native audio did not resume"));
      };
      const onPlaying = () => done(true);
      const onError = () => done(false);
      const timer = setTimeout(() => done(false), PLAY_CONFIRM_MS);
      this.addEventListener("playing", onPlaying);
      this.addEventListener("error", onError);
      post({ type: "resume" });
    });
  }

  pause() {
    post({ type: "pause" });
  }

  stop() {
    this.paused = true;
    post({ type: "stop" });
  }
}
