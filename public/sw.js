// Storyflow offline service worker. Pairs with src/lib/offline.ts, which does the actual
// downloading into the same caches — this worker only answers requests from them.
//
// Caches (names are shared with offline.ts — keep them in sync):
//   sf-static  /_next/static/** (hashed, immutable) — cached on every fetch, cache-first.
//   sf-pages   page HTML and /api JSON — network-first, cache as the offline fallback.
//   sf-media   chapter illustrations, keyed by source URL (see imageKey) — downloaded only.
//   sf-audio   /api/speak narration chunks — downloaded only.
//   sf-outbox  reading-position POSTs that failed offline, replayed once back online.
//
// Chapter pages and chapter JSON are only kept fresh once downloaded; library/book/settings pages
// and the small book-level JSON are cached as they're visited, so the shell opens offline.

const STATIC = "sf-static";
const PAGES = "sf-pages";
const MEDIA = "sf-media";
const AUDIO = "sf-audio";
const OUTBOX = "sf-outbox";

// A flaky connection (plane wifi, a tunnel) should fall back to the saved copy instead of
// hanging; a request that's merely slow still wins if nothing is saved.
const NETWORK_TIMEOUT_MS = 5000;

const CHAPTER_PAGE = /^\/book\/[^/]+\/\d+\/?$/;
const CHAPTER_API = /^\/api\/books\/[^/]+\/chapters\/\d+$/;

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim().then(flushOutbox)));

self.addEventListener("message", (event) => {
  if (event.data === "flush-outbox") event.waitUntil(flushOutbox());
});

// Illustrations reach the page through the image optimizer (/_next/image?url=<src>&w=…), at
// whatever width the srcset picks; they're stored under one key per source image.
function imageKey(src) {
  return `/__sf/img?src=${encodeURIComponent(src)}`;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method === "POST" && url.origin === self.location.origin && url.pathname === "/api/bookmarks") {
    event.respondWith(postBookmark(request));
    return;
  }
  if (request.method !== "GET") return;

  if (url.origin !== self.location.origin) return;

  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(staticCacheFirst(request));
  } else if (url.pathname === "/_next/image") {
    const src = url.searchParams.get("url");
    if (src) event.respondWith(cachedOrNetwork(MEDIA, imageKey(src), request));
  } else if (url.pathname === "/api/speak") {
    event.respondWith(cachedAudioOrNetwork(request));
  } else if (request.mode === "navigate") {
    event.respondWith(networkFirst(request, { alwaysStore: !CHAPTER_PAGE.test(url.pathname), offlinePage: true }));
  } else if (url.pathname.startsWith("/api/")) {
    event.respondWith(networkFirst(request, { alwaysStore: !CHAPTER_API.test(url.pathname) }));
  }
});

async function staticCacheFirst(request) {
  const cache = await caches.open(STATIC);
  const hit = await cache.match(request);
  if (hit) return hit;
  const res = await fetch(request);
  if (res.ok) cache.put(request, res.clone());
  return res;
}

async function cachedOrNetwork(cacheName, key, request) {
  const hit = await (await caches.open(cacheName)).match(key, { ignoreVary: true });
  return hit ?? fetch(request);
}

// Narration URLs carry a voice version (&v=…, see speak.ts). Chunks downloaded before the voice
// changed are saved under the old URL — offline, the old voice still beats silence.
async function cachedAudioOrNetwork(request) {
  const cache = await caches.open(AUDIO);
  const hit = await cache.match(request.url, { ignoreVary: true });
  if (hit) return hit;
  try {
    return await fetch(request);
  } catch (err) {
    // String surgery, not searchParams.delete(): re-serializing would turn the text's %20s into
    // "+" and miss the stored key.
    const older = await cache.match(request.url.replace(/&v=[^&]*$/, ""), { ignoreVary: true });
    if (older) return older;
    throw err;
  }
}

function withTimeout(promise, ms) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("timeout")), ms);
    promise.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        clearTimeout(timer);
        reject(e);
      },
    );
  });
}

async function networkFirst(request, { alwaysStore, offlinePage = false }) {
  const cache = await caches.open(PAGES);
  const cached = await cache.match(request, { ignoreVary: true });
  const network = fetch(request).then(async (res) => {
    if (res.ok && (alwaysStore || cached)) await cache.put(request, res.clone());
    return res;
  });
  network.catch(() => {}); // when the saved copy wins the race, a later network failure is expected
  try {
    // Only race the clock when there's something saved to fall back to.
    return await (cached ? withTimeout(network, NETWORK_TIMEOUT_MS) : network);
  } catch {
    if (cached) return cached;
    if (offlinePage) return notDownloadedPage(request.url);
    return Response.error();
  }
}

function notDownloadedPage(href) {
  const match = new URL(href).pathname.match(/^\/book\/([^/]+)/);
  const back = match ? `/book/${match[1]}` : "/";
  const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Storyflow</title><style>body{font-family:-apple-system,system-ui,sans-serif;background:#f7f5f0;color:#2b2622;display:flex;min-height:80vh;align-items:center;justify-content:center;text-align:center;padding:24px}a{color:#9a5b3c}@media(prefers-color-scheme:dark){body{background:#1c1a18;color:#ece6dc}a{color:#d79a78}}</style></head>
<body><div><p>오프라인이에요. 이 페이지는 저장되지 않았어요.<br>You're offline, and this page isn't downloaded.</p><p><a href="${back}">← 돌아가기 / Back</a></p></div></body></html>`;
  return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
}

// Reading position: the server keeps one bookmark per reader+book, so only the latest queued
// POST per book matters — each one overwrites the last.
async function postBookmark(request) {
  const body = await request.clone().text();
  let bookId = "unknown";
  try {
    bookId = String(JSON.parse(body).bookId);
  } catch {}
  const key = `/__sf/outbox/bookmark?book=${encodeURIComponent(bookId)}`;
  const outbox = await caches.open(OUTBOX);
  try {
    const res = await fetch(request);
    // A newer position just reached the server — drop any older queued one so a later replay
    // can't rewind it.
    if (res.ok) await outbox.delete(key);
    return res;
  } catch {
    await outbox.put(key, new Response(body, { headers: { "Content-Type": "application/json" } }));
    return new Response(JSON.stringify({ queued: true }), {
      status: 202,
      headers: { "Content-Type": "application/json" },
    });
  }
}

async function flushOutbox() {
  const outbox = await caches.open(OUTBOX);
  for (const key of await outbox.keys()) {
    const saved = await outbox.match(key);
    if (!saved) continue;
    try {
      const res = await fetch("/api/bookmarks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: await saved.text(),
      });
      if (res.ok) await outbox.delete(key);
    } catch {
      return; // still offline — try again next time
    }
  }
}
