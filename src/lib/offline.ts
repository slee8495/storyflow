// Offline downloads: saves pages, chapter text, illustrations and narration into the caches that
// public/sw.js serves from when there's no connection. This file writes; the service worker
// reads. Cache names and the image key format are shared with sw.js — keep them in sync.
//
// What's downloaded is tracked in a small localStorage manifest (per book → per chapter: text
// saved, which narration languages saved, bytes). Per-chapter cache keys aren't stored there — a
// chapter's narration alone is ~100 long URLs — they're recomputed from the saved chapter JSON
// when deleting.

import { speechRequestUrls } from "./speak";

export type Lang = "ko" | "en";

const STATIC = "sf-static";
const PAGES = "sf-pages";
const MEDIA = "sf-media";
const AUDIO = "sf-audio";
const ALL_CACHES = [STATIC, PAGES, MEDIA, AUDIO, "sf-outbox"];

const MANIFEST_KEY = "storyflow:offline";
export const AUTO_DELETE_KEY = "storyflow:offline:autoDeleteReadAudio";
export const MANIFEST_EVENT = "storyflow:offline-changed";

// Narration requests take a few seconds each when the audio hasn't been generated before; a few
// at a time keeps a 100-chunk chapter to a couple of minutes without hammering the TTS route.
const AUDIO_CONCURRENCY = 4;
// Chapter text that was never opened is generated on first request (minutes for Lady
// Chatterley), so these also run a couple at a time.
const CHAPTER_CONCURRENCY = 2;
// Width requested from the image optimizer — matches what a phone's srcset picks (see the
// chapter page's illustrationImageProps); any width is served from the same saved copy.
const OPTIMIZED_IMAGE_WIDTH = 1200;

export type ChapterEntry = { text: boolean; audio: Lang[]; bytes: number; audioBytes: Partial<Record<Lang, number>> };
export type BookEntry = { title: string; chapters: Record<string, ChapterEntry> };
export type Manifest = { books: Record<string, BookEntry> };

export function offlineSupported(): boolean {
  return typeof window !== "undefined" && "serviceWorker" in navigator && "caches" in window;
}

export function readManifest(): Manifest {
  try {
    const parsed = JSON.parse(localStorage.getItem(MANIFEST_KEY) ?? "null") as Manifest | null;
    if (parsed?.books) return parsed;
  } catch {
    // corrupt or unavailable — treat as nothing downloaded
  }
  return { books: {} };
}

function writeManifest(manifest: Manifest) {
  try {
    localStorage.setItem(MANIFEST_KEY, JSON.stringify(manifest));
  } catch {
    // storage full or blocked — the caches still hold the data, the list just won't show it
  }
  window.dispatchEvent(new Event(MANIFEST_EVENT));
}

function updateChapter(slug: string, title: string, chapterNumber: number, change: (entry: ChapterEntry) => void) {
  const manifest = readManifest();
  const book = (manifest.books[slug] ??= { title, chapters: {} });
  book.title = title;
  const entry = (book.chapters[chapterNumber] ??= { text: false, audio: [], bytes: 0, audioBytes: {} });
  change(entry);
  writeManifest(manifest);
}

export function chapterBytes(entry: ChapterEntry): number {
  return entry.bytes + Object.values(entry.audioBytes).reduce((sum, b) => sum + (b ?? 0), 0);
}

export function bookBytes(book: BookEntry): number {
  return Object.values(book.chapters).reduce((sum, c) => sum + chapterBytes(c), 0);
}

export function formatBytes(bytes: number): string {
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(1)}GB`;
  if (bytes >= 1024 ** 2) return `${Math.round(bytes / 1024 ** 2)}MB`;
  return `${Math.max(1, Math.round(bytes / 1024))}KB`;
}

function imageKey(src: string) {
  return `/__sf/img?src=${encodeURIComponent(src)}`;
}

const chapterPageUrl = (slug: string, n: number) => `/book/${slug}/${n}`;
const chapterApiUrl = (slug: string, n: number, readerId: number) => `/api/books/${slug}/chapters/${n}?readerId=${readerId}`;

// Fetches `url` and saves it under `key`, returning the bytes saved. Copies the body into a fresh
// Response so a redirect (/api/speak answers with a 302 to blob storage) is stored as a plain 200.
async function save(cacheName: string, url: string, key = url, signal?: AbortSignal): Promise<number> {
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`${res.status} for ${url}`);
  const blob = await res.blob();
  const headers = new Headers();
  const type = res.headers.get("Content-Type");
  if (type) headers.set("Content-Type", type);
  await (await caches.open(cacheName)).put(key, new Response(blob, { headers }));
  return blob.size;
}

// Wikimedia answers bursts of image requests with 429 Too Many Requests, and a TTS chunk can
// fail transiently — so each download gets a couple of spaced-out retries before counting as failed.
const RETRY_DELAYS_MS = [2000, 6000];

async function withRetry<T>(fn: () => Promise<T>, signal?: AbortSignal): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (signal?.aborted || attempt >= RETRY_DELAYS_MS.length) throw err;
      await new Promise((r) => setTimeout(r, RETRY_DELAYS_MS[attempt]));
    }
  }
}

// Runs `worker` over `items`, `limit` at a time.
async function pool<T>(items: T[], limit: number, worker: (item: T) => Promise<void>) {
  const queue = [...items];
  await Promise.all(
    Array.from({ length: Math.min(limit, queue.length) }, async () => {
      while (queue.length) await worker(queue.shift()!);
    }),
  );
}

// Every /_next/static asset a saved page needs: the scripts and stylesheets its HTML names, plus
// the fonts its stylesheets name.
async function saveStaticAssets(html: string, seen: Set<string>, signal?: AbortSignal) {
  const assets = [...new Set(html.match(/\/_next\/static\/[^"'\\\s)<>]+/g) ?? [])].filter((a) => !seen.has(a));
  const cache = await caches.open(STATIC);
  await pool(assets, 6, async (asset) => {
    seen.add(asset);
    if (await cache.match(asset)) return;
    const res = await fetch(asset, { signal });
    if (!res.ok) return;
    if (asset.endsWith(".css")) {
      const css = await res.clone().text();
      await saveStaticAssets(css.replace(/url\(([^)]+)\)/g, " $1 "), seen, signal);
    }
    await cache.put(asset, res);
  });
}

async function savePage(url: string, seen: Set<string>, signal?: AbortSignal): Promise<number> {
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`${res.status} for ${url}`);
  const html = await res.clone().text();
  await (await caches.open(PAGES)).put(url, res);
  await saveStaticAssets(html, seen, signal);
  return html.length;
}

type Illustration = { imageUrl: string };
type ChapterJson = { chapter: { storyKo: string | null; storyEn: string | null }; illustrations: Illustration[] };

async function saveIllustration(src: string, signal?: AbortSignal): Promise<number> {
  if (await (await caches.open(MEDIA)).match(imageKey(src))) return 0;
  const optimized = `/_next/image?url=${encodeURIComponent(src)}&w=${OPTIMIZED_IMAGE_WIDTH}&q=75`;
  return withRetry(() => save(MEDIA, optimized, imageKey(src), signal), signal);
}

async function savedChapterJson(slug: string, n: number, readerId: number): Promise<ChapterJson | null> {
  const hit = await (await caches.open(PAGES)).match(chapterApiUrl(slug, n, readerId), { ignoreVary: true });
  return hit ? ((await hit.json()) as ChapterJson) : null;
}

function storyFor(json: ChapterJson, lang: Lang) {
  return (lang === "en" ? json.chapter.storyEn : json.chapter.storyKo) ?? "";
}

export type DownloadPlan = {
  slug: string;
  title: string;
  readerId: number;
  textChapters: number[];
  audioChapters: number[];
  audioLangs: Lang[];
};

export type DownloadProgress = {
  textDone: number;
  textTotal: number;
  audioDone: number;
  audioTotal: number;
  // Chunks finished in the chapter whose narration is downloading right now.
  audioChunkDone: number;
  audioChunkTotal: number;
  failed: number;
};

export async function downloadBook(plan: DownloadPlan, onProgress: (p: DownloadProgress) => void, signal: AbortSignal) {
  const { slug, title, readerId } = plan;
  // Narration needs the chapter's text, so every audio chapter is a text chapter too.
  const textChapters = [...new Set([...plan.textChapters, ...plan.audioChapters])].sort((a, b) => a - b);
  const progress: DownloadProgress = {
    textDone: 0,
    textTotal: textChapters.length,
    audioDone: 0,
    audioTotal: plan.audioChapters.length * plan.audioLangs.length,
    audioChunkDone: 0,
    audioChunkTotal: 0,
    failed: 0,
  };
  const report = () => onProgress({ ...progress });
  report();

  await navigator.storage?.persist?.().catch(() => false);
  const seen = new Set<string>();

  // The library, this book's page, settings, and the JSON they load — so the app opens offline.
  for (const page of ["/", `/book/${slug}`, "/settings"]) await savePage(page, seen, signal);
  for (const api of [
    `/api/books?readerId=${readerId}`,
    `/api/books/${slug}?readerId=${readerId}`,
    `/api/books/${slug}/progress?readerId=${readerId}`,
    `/api/books/${slug}/marks?readerId=${readerId}`,
  ]) {
    await save(PAGES, api, api, signal).catch(() => 0);
  }

  await pool(textChapters, CHAPTER_CONCURRENCY, async (n) => {
    if (signal.aborted) return;
    try {
      let bytes = await savePage(chapterPageUrl(slug, n), seen, signal);
      bytes += await save(PAGES, chapterApiUrl(slug, n, readerId), undefined, signal);
      const json = await savedChapterJson(slug, n, readerId);
      // A chapter only counts as saved with its pictures, so a re-run retries a missed one.
      for (const ill of json?.illustrations ?? []) bytes += await saveIllustration(ill.imageUrl, signal);
      updateChapter(slug, title, n, (entry) => {
        entry.text = true;
        entry.bytes = bytes;
      });
    } catch {
      if (!signal.aborted) progress.failed++;
    }
    progress.textDone++;
    report();
  });

  for (const n of plan.audioChapters) {
    for (const lang of plan.audioLangs) {
      if (signal.aborted) return;
      const json = await savedChapterJson(slug, n, readerId);
      const urls = json ? speechRequestUrls(storyFor(json, lang)) : [];
      progress.audioChunkDone = 0;
      progress.audioChunkTotal = urls.length;
      report();
      const audioCache = await caches.open(AUDIO);
      let bytes = 0;
      let missing = urls.length === 0 ? 1 : 0;
      await pool(urls, AUDIO_CONCURRENCY, async (url) => {
        if (signal.aborted) return;
        try {
          const hit = await audioCache.match(url);
          bytes += hit ? (await hit.clone().blob()).size : await withRetry(() => save(AUDIO, url, url, signal), signal);
        } catch {
          missing++;
        }
        progress.audioChunkDone++;
        report();
      });
      if (signal.aborted) return;
      if (missing === 0) {
        updateChapter(slug, title, n, (entry) => {
          if (!entry.audio.includes(lang)) entry.audio.push(lang);
          entry.audioBytes[lang] = bytes;
        });
      } else {
        progress.failed++;
      }
      progress.audioDone++;
      report();
    }
  }
}

export async function deleteChapterAudio(slug: string, n: number, readerId: number, langs: Lang[] = ["ko", "en"]) {
  const json = await savedChapterJson(slug, n, readerId);
  if (json) {
    const cache = await caches.open(AUDIO);
    for (const lang of langs) for (const url of speechRequestUrls(storyFor(json, lang))) await cache.delete(url);
  }
  const manifest = readManifest();
  const entry = manifest.books[slug]?.chapters[n];
  if (!entry) return;
  entry.audio = entry.audio.filter((l) => !langs.includes(l));
  for (const lang of langs) delete entry.audioBytes[lang];
  writeManifest(manifest);
}

export async function deleteChapter(slug: string, n: number, readerId: number) {
  await deleteChapterAudio(slug, n, readerId);
  const json = await savedChapterJson(slug, n, readerId);
  const media = await caches.open(MEDIA);
  for (const ill of json?.illustrations ?? []) await media.delete(imageKey(ill.imageUrl));
  const pages = await caches.open(PAGES);
  await pages.delete(chapterPageUrl(slug, n), { ignoreVary: true });
  await pages.delete(chapterApiUrl(slug, n, readerId), { ignoreVary: true });
  const manifest = readManifest();
  const book = manifest.books[slug];
  if (!book) return;
  delete book.chapters[n];
  if (Object.keys(book.chapters).length === 0) delete manifest.books[slug];
  writeManifest(manifest);
}

export async function deleteBookAudio(slug: string, readerId: number) {
  const book = readManifest().books[slug];
  for (const n of Object.keys(book?.chapters ?? {})) await deleteChapterAudio(slug, Number(n), readerId);
}

export async function deleteBook(slug: string, readerId: number) {
  const book = readManifest().books[slug];
  for (const n of Object.keys(book?.chapters ?? {})) await deleteChapter(slug, Number(n), readerId);
  const pages = await caches.open(PAGES);
  for (const url of [
    `/book/${slug}`,
    `/api/books/${slug}?readerId=${readerId}`,
    `/api/books/${slug}/progress?readerId=${readerId}`,
    `/api/books/${slug}/marks?readerId=${readerId}`,
  ]) {
    await pages.delete(url, { ignoreVary: true });
  }
  if (Object.keys(readManifest().books).length === 0) {
    // Nothing left downloaded: drop the shared app files too.
    await Promise.all(ALL_CACHES.filter((c) => c !== "sf-outbox").map((c) => caches.delete(c)));
  }
}

// "Delete narration of chapters I've finished": everything before the chapter now being read.
export async function pruneReadAudio(slug: string, currentChapter: number, readerId: number) {
  let enabled = false;
  try {
    enabled = localStorage.getItem(AUTO_DELETE_KEY) === "1";
  } catch {}
  if (!enabled) return;
  const book = readManifest().books[slug];
  for (const [n, entry] of Object.entries(book?.chapters ?? {})) {
    if (Number(n) < currentChapter && entry.audio.length > 0) await deleteChapterAudio(slug, Number(n), readerId);
  }
}
