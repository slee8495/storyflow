// Client-side helper for reading reply/reading text aloud. Prefers the neural /api/speak voice
// (AI Gateway TTS) and falls back to the browser's built-in Web Speech API if that request
// fails entirely (offline, cold start, etc).
//
// Every requested chunk's audio is fetched, decoded, and concatenated into ONE continuous file
// before playback starts, rather than chained via a separate play() call per sentence. Mobile
// browsers only reliably honor background/screen-lock playback for a single ongoing session
// started by a user gesture — calling play() again for a new source mid-session (even reusing
// the same <audio> element) can silently fail once the app is actually backgrounded, which
// showed up as playback either stopping dead or racing through the remaining sentences almost
// instantly. A single native playback from one gesture-started element sidesteps that.
//
// Concatenation happens at the PCM level via the Web Audio API, not by gluing the raw MP3 byte
// streams together — each independently-generated MP3 carries its own small encoder
// priming/padding, so naive byte concatenation's "sum of each clip's own reported duration"
// drifts from how long the glued-together file actually plays. That drift compounds with every
// chunk, which is exactly what made sentence highlighting fall out of sync with the audio on
// anything longer than a couple of sentences — a full novel chapter has 20-40+ chunks, plenty for
// the drift to become obvious (a few-sentence Bible passage rarely has enough chunks for anyone
// to notice). Decoding each chunk to exact PCM samples and concatenating THOSE, then re-encoding
// as one WAV blob, makes chunk boundary timing sample-accurate instead of estimated.
//
// The tradeoff: since concatenation needs every chunk's bytes up front, playback can't start
// until all of them are ready — slower to first sound than playing chunk 0 the moment it lands,
// but chunks are still fetched (and decoded) in parallel, so the wait is bounded by the slowest
// one, not the sum of all of them.
//
// Overlapping playback ("multiple voices at once"): if a new speak() call comes in while a
// previous one is still preparing, the old call would eventually finish and start playing right
// on top of the new one. A monotonic token invalidates any in-flight call as soon as a newer one
// starts, so stale audio never gets played.
import { NativeAudio, nativeAudioAvailable } from "./nativeAudio";

const audioBufferCache = new Map<string, ArrayBuffer>();
const inFlight = new Map<string, Promise<ArrayBuffer | null>>();
// Reused across sessions instead of a fresh `new Audio()` every time — see the file header for
// why a single gesture-started element matters for background playback. Inside the iPhone app
// this is a NativeAudio bridge instead (see nativeAudio.ts for why).
let currentAudio: HTMLAudioElement | NativeAudio | null = null;
// Lazily created and reused — one AudioContext per page, not one per speak() call.
let audioContext: AudioContext | null = null;
// Resolves the playback promise currently in flight, if any — stopSpeaking() uses this to
// unblock a hung await immediately instead of waiting on an event that may never fire.
let currentStopResolve: (() => void) | null = null;
// Detaches the current session's event listeners — stopSpeaking() calls this directly so a
// superseded session's 'ended'/'timeupdate' handlers (closing over its own stale offsets/opts)
// can't keep firing into the next session once it reuses the same <audio> element.
let activeCleanup: (() => void) | null = null;
let activeObjectUrl: string | null = null;
let playToken = 0;

const MAX_CHUNK_LENGTH = 200;

export function splitIntoChunks(text: string): string[] {
  // Used to require [.!?]+ to be followed by whitespace-or-end to count as a sentence boundary,
  // to avoid treating something like "3.14" as two sentences. But dialogue-heavy prose (story
  // mode is full of it) routinely has the closing punctuation land *inside* a quote with nothing
  // but more text right after — English: `said, "My son." "Yes?" Esau replied.` (quote then a
  // space, still fine) but Korean quotative grammar attaches the next word directly with NO space
  // at all: `...하셨나요?"라고 물었습니다` (question mark, closing quote, then straight into the
  // next word). Requiring a trailing whitespace/end at that position can never match, and
  // `String.match` with /g just silently skips forward to wherever it next CAN match — dropping
  // every sentence in between entirely (confirmed: this is what made the opening of Genesis 27's
  // story mode disappear, and separately, whole clauses inside other readings' Korean story text
  // whenever a quote ended with a directly-attached particle). Dropping the requirement instead of
  // trying to enumerate every language's attachment rule guarantees every character of the input
  // ends up in some chunk — verified by reconstructing the original string from the chunks.
  const sentences = text.match(/[^.!?]+[.!?]+["'‘’“”]*|[^.!?]+$/g) ?? [text];
  const chunks: string[] = [];
  let buf = "";
  for (const sentence of sentences) {
    if (buf && buf.length + sentence.length > MAX_CHUNK_LENGTH) {
      chunks.push(buf.trim());
      buf = sentence;
    } else {
      buf += sentence;
    }
  }
  if (buf.trim()) chunks.push(buf.trim());
  return chunks;
}

// By-verse passage text carries "(1) ", "(2) " ... markers so readers can see verse boundaries —
// but a TTS engine reads them back literally as numbers ("one", "two"...), which is exactly the
// bug this strips: the marker is display-only, spoken text should never include it. Global (not
// just a leading match) since MAX_CHUNK_LENGTH bucketing can group more than one short verse into
// a single chunk, putting a second "(N) " mid-string.
function stripVerseMarkers(text: string): string {
  return text.replace(/\(\d+\)\s*/g, "");
}

function speakWithBrowserVoice(text: string, onStart?: () => void) {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 0.95;
  if (onStart) utterance.onstart = onStart;
  window.speechSynthesis.speak(utterance);
}

// A hard stop: abandons whatever's currently playing/preparing and unblocks speak()'s awaited
// promise so a caller's `await speak(...)` reliably returns instead of hanging forever.
export function stopSpeaking() {
  playToken++;
  activeCleanup?.();
  activeCleanup = null;
  if (currentAudio instanceof NativeAudio) currentAudio.stop();
  else currentAudio?.pause();
  if (typeof window !== "undefined" && window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }
  currentStopResolve?.();
  currentStopResolve = null;
}

// A soft pause: unlike stopSpeaking(), deliberately does NOT resolve the in-flight playback
// promise or touch playToken — the sequence should stay suspended where it is and pick back up
// via resumeSpeaking(), not jump ahead or fall back to the browser voice.
export function pauseSpeaking() {
  currentAudio?.pause();
  if (typeof window !== "undefined" && window.speechSynthesis?.speaking) {
    window.speechSynthesis.pause();
  }
}

// Resolves true only if audio actually resumed — a lock-screen "play" tap after the phone has
// been backgrounded/locked for a while can reach this code with `currentAudio` pointing at an
// element whose underlying buffered data iOS has quietly discarded (or the audio has been
// interrupted, e.g. by a phone call), in which case .play() rejects or resolves without ever
// actually starting. Silently swallowing that (as this used to do) left the UI/media-session
// stuck showing "playing" forever with no sound — the caller uses the return value to reset back
// to a clean not-playing state instead, so at least it's honestly showing nothing is happening.
export async function resumeSpeaking(): Promise<boolean> {
  if (typeof window !== "undefined" && window.speechSynthesis?.paused) {
    window.speechSynthesis.resume();
    return true;
  }
  if (!currentAudio) return false;
  try {
    await currentAudio.play();
    return !currentAudio.paused;
  } catch {
    return false;
  }
}

function fetchAudioBuffer(text: string): Promise<ArrayBuffer | null> {
  const cached = audioBufferCache.get(text);
  if (cached) return Promise.resolve(cached);

  const pending = inFlight.get(text);
  if (pending) return pending;

  const promise = fetch(`/api/speak?text=${encodeURIComponent(text)}`)
    .then((res) => {
      if (!res.ok) throw new Error("tts request failed");
      return res.arrayBuffer();
    })
    .then((buffer) => {
      audioBufferCache.set(text, buffer);
      return buffer;
    })
    .catch(() => null)
    .finally(() => inFlight.delete(text));

  inFlight.set(text, promise);
  return promise;
}

function getAudioContext(): AudioContext {
  if (!audioContext) audioContext = new AudioContext();
  return audioContext;
}

// Decodes one chunk's compressed bytes into exact PCM samples — `AudioBuffer.duration` from this
// point on is ground truth for how long the chunk will actually play, unlike a container header's
// (sometimes wrong) reported duration. Passes a *copy* of the buffer: decodeAudioData detaches the
// ArrayBuffer it's given, and audioBufferCache above needs the original to stay usable if the same
// chunk text is ever requested again.
function decodeChunk(buffer: ArrayBuffer): Promise<AudioBuffer | null> {
  return getAudioContext()
    .decodeAudioData(buffer.slice(0))
    .catch(() => null);
}

// TTS voice output decodes at 48kHz, which is complete overkill for spoken word — encoding a
// full chapter's worth of chunks (a novel chapter can run 100+ sentences, 15-20+ minutes of
// audio) at that rate produces a 100MB+ WAV file, which is a real memory/bandwidth concern on
// mobile even though it plays fine once loaded. 16kHz is standard for clear speech (well above
// telephone-quality 8kHz) and cuts the file to roughly a third.
const OUTPUT_SAMPLE_RATE = 16000;

// Concatenates decoded PCM chunks into one gapless buffer AND resamples to OUTPUT_SAMPLE_RATE in
// the same pass — sample-accurate (unlike concatenating the original compressed byte streams; see
// the file header) and far smaller once WAV-encoded. OfflineAudioContext resamples automatically
// when its own sample rate differs from a scheduled source buffer's native rate, so scheduling
// each chunk back-to-back via start(when) does both jobs at once instead of a separate resample
// pass. Real-world duration is preserved exactly regardless of sample rate, so the cumulative
// `cursor += c.buffer.duration` offset math in speak() (computed from the pre-resample buffers)
// stays valid against this rendered result.
async function renderCombinedBuffer(buffers: AudioBuffer[]): Promise<AudioBuffer> {
  const channels = buffers[0].numberOfChannels;
  const totalDuration = buffers.reduce((sum, b) => sum + b.duration, 0);
  const offlineCtx = new OfflineAudioContext(
    channels,
    Math.ceil(totalDuration * OUTPUT_SAMPLE_RATE),
    OUTPUT_SAMPLE_RATE,
  );

  let when = 0;
  for (const buf of buffers) {
    const source = offlineCtx.createBufferSource();
    source.buffer = buf;
    source.connect(offlineCtx.destination);
    source.start(when);
    when += buf.duration;
  }

  return offlineCtx.startRendering();
}

// Encodes a decoded PCM buffer as a playable WAV blob — <audio> elements don't accept raw
// AudioBuffers directly, and WAV (uncompressed, no per-file encoder padding) is the simplest
// container that preserves the sample-accurate concatenation above exactly as decoded.
function audioBufferToWavBlob(buffer: AudioBuffer): Blob {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const bytesPerSample = 2; // 16-bit PCM
  const blockAlign = numChannels * bytesPerSample;
  const dataLength = buffer.length * blockAlign;
  const arrayBuffer = new ArrayBuffer(44 + dataLength);
  const view = new DataView(arrayBuffer);

  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  };

  writeString(0, "RIFF");
  view.setUint32(4, 36 + dataLength, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bytesPerSample * 8, true);
  writeString(36, "data");
  view.setUint32(40, dataLength, true);

  const channelData: Float32Array[] = [];
  for (let ch = 0; ch < numChannels; ch++) channelData.push(buffer.getChannelData(ch));

  // A full chapter's audio runs tens of millions of samples (measured: ~17 minutes for one
  // 125-sentence chapter at 48kHz). Writing each one via DataView.setInt16 — one bounds-checked,
  // endianness-converting call per sample — blocked the main thread for a minute or more, an even
  // worse regression than the drift bug this rewrite was fixing. Writing into a plain Int16Array
  // view instead is a JIT-optimized indexed store, not a per-call DataView operation, and is
  // little-endian on every real browser target (matching what WAV's data section requires) —
  // measured well under a second for the same chapter after this change.
  const pcm16 = new Int16Array(arrayBuffer, 44, buffer.length * numChannels);
  let idx = 0;
  for (let i = 0; i < buffer.length; i++) {
    for (let ch = 0; ch < numChannels; ch++) {
      const sample = Math.max(-1, Math.min(1, channelData[ch][i]));
      pcm16[idx++] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
    }
  }

  return new Blob([arrayBuffer], { type: "audio/wav" });
}

export async function speak(
  text: string,
  opts: {
    onPlaybackStart?: () => void;
    onChunkStart?: (index: number) => void;
    startIndex?: number;
    // Shown on the lock screen / CarPlay when the iPhone app plays natively.
    title?: string;
    // Paused or resumed from outside the page (lock screen, CarPlay, a call ending), so the UI can follow.
    onExternalPause?: () => void;
    onExternalResume?: () => void;
  } = {},
) {
  if (!text.trim()) return;
  stopSpeaking(); // also bumps playToken, so capture `token` only after this
  const token = playToken;

  const chunks = splitIntoChunks(text);
  const startIndex = Math.min(Math.max(opts.startIndex ?? 0, 0), Math.max(chunks.length - 1, 0));
  const requested = chunks.slice(startIndex);

  // Chunk boundaries/indices below (offsets, activeChunkIndex, highlighting) all stay keyed off
  // the ORIGINAL `chunks`/`requested` text, so stripping markers only for the TTS request doesn't
  // shift anything the UI depends on for click-to-seek or highlight sync.
  const buffers = await Promise.all(requested.map((chunk) => fetchAudioBuffer(stripVerseMarkers(chunk))));
  if (token !== playToken) return;

  // Chunks that failed to generate are quietly skipped from the combined file rather than
  // derailing the whole passage into the browser voice over one flaky request — only a total
  // outage (every chunk failed) falls back to reading everything requested via speechSynthesis.
  const ok: { buffer: ArrayBuffer; index: number }[] = [];
  buffers.forEach((buffer, i) => {
    if (buffer) ok.push({ buffer, index: startIndex + i });
  });

  if (ok.length === 0) {
    speakWithBrowserVoice(requested.join(" "), () => {
      opts.onChunkStart?.(startIndex);
      opts.onPlaybackStart?.();
    });
    return;
  }

  const decoded = await Promise.all(ok.map((c) => decodeChunk(c.buffer)));
  if (token !== playToken) return;

  // A chunk that fails to decode (corrupt response, unsupported edge case) is dropped the same
  // way a chunk that failed to fetch already was above.
  const decodedOk: { buffer: AudioBuffer; index: number }[] = [];
  decoded.forEach((buffer, i) => {
    if (buffer) decodedOk.push({ buffer, index: ok[i].index });
  });

  if (decodedOk.length === 0) {
    speakWithBrowserVoice(requested.join(" "), () => {
      opts.onChunkStart?.(startIndex);
      opts.onPlaybackStart?.();
    });
    return;
  }

  const combined = await renderCombinedBuffer(decodedOk.map((c) => c.buffer));
  if (token !== playToken) return;
  const blob = audioBufferToWavBlob(combined);
  const url = URL.createObjectURL(blob);
  if (activeObjectUrl) URL.revokeObjectURL(activeObjectUrl);
  activeObjectUrl = url;

  // Cumulative start time (seconds) for each included chunk, paired with its real index into
  // `chunks` (not its position in `ok`/`decodedOk`, since failed chunks were dropped). Durations
  // come straight from each chunk's own decoded sample count — sample-accurate, see the file
  // header.
  let cursor = 0;
  const offsets = decodedOk.map((c) => {
    const start = cursor;
    cursor += c.buffer.duration;
    return { start, index: c.index };
  });

  const audio = nativeAudioAvailable()
    ? currentAudio instanceof NativeAudio
      ? currentAudio
      : new NativeAudio()
    : currentAudio instanceof HTMLAudioElement
      ? currentAudio
      : new Audio();
  currentAudio = audio;

  await new Promise<void>((resolve) => {
    currentStopResolve = resolve;

    let announced = false;
    const onPlaying = () => {
      if (announced) {
        opts.onExternalResume?.();
        return;
      }
      announced = true;
      opts.onPlaybackStart?.();
      opts.onChunkStart?.(offsets[0].index);
    };
    const onTimeUpdate = () => {
      const t = audio.currentTime;
      let current = offsets[0].index;
      for (const o of offsets) {
        if (t >= o.start) current = o.index;
        else break;
      }
      opts.onChunkStart?.(current);
    };
    const onPause = () => opts.onExternalPause?.();
    const onEnded = () => finish();
    const onError = () => finish();
    function finish() {
      audio.removeEventListener("playing", onPlaying);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("error", onError);
      activeCleanup = null;
      currentStopResolve = null;
      resolve();
    }
    activeCleanup = finish;

    audio.addEventListener("playing", onPlaying);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("ended", onEnded, { once: true });
    audio.addEventListener("error", onError, { once: true });

    if (audio instanceof NativeAudio) {
      audio.load(blob, opts.title ?? "Storyflow").catch(() => finish());
    } else {
      audio.src = url;
      audio.play().catch(() => finish());
    }
  });
}
