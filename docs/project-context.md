# Storyflow — Project Context

Working name: **Storyflow**. Sibling project to [Wordflow](../../wordflow) (same `SL Studio` folder) — easy
to rename later, nothing below depends on the name.

## Origin

Wordflow (a personal daily-Bible-reading app) fetches NLT English scripture text and has Claude
Haiku rewrite it into an easy, engaging story-style narration (Korean + English), because the
original found scripture hard to approach due to dense/unfamiliar language and terms. It worked —
reading the Bible actually clicked for the first time.

Storyflow applies the same idea to novels/sagas the original has always wanted to read but never
finished because the source text itself is what's in the way (density, length, archaic prose) —
not the story. Examples raised during scoping: Game of Thrones, Romance of the Three Kingdoms,
a Toyotomi Hideyoshi saga, Harry Potter, Dune, the Odyssey.

## IMPORTANT — legal scope, read before adding sharing/monetization

This app is **personal, single-user use only** until further notice:

- No distribution, no sharing with anyone else (not even Wordflow-style family/passphrase
  sharing), no monetization, no public deployment for others to use.
- Only process text from books the operator has legally acquired/owns, or genuine public-domain
  works.
- Reasoning: modern in-copyright novels (GoT, Harry Potter, Dune, etc.) have no licensed
  free-text API the way Wordflow's NLT API is licensed for Bible text — using an LLM to rewrite
  and serve their text is a derivative-work / redistribution concern once it goes beyond strictly
  personal use. Scoped to personal-only + owned-books-only, the risk is negligible (same category
  as running a TTS reader or translator over a book you own).
- **If this ever gets extended toward being a real product/business, that requires proper
  licensing first.** The operator said he'll explicitly flag it if he thinks there's a real
  business opportunity here — treat any future request to add subscriptions, multi-user accounts,
  or public distribution as a signal to raise the licensing question again before building it,
  not to proceed straight to building it.
- Public-domain source texts (see below) aren't restricted the same way — the app itself is still
  scoped personal-only for now regardless of which book is loaded.

## First build target: 삼국지 (Romance of the Three Kingdoms)

- Public domain — no book purchase needed, full text is freely available (Chinese/Korean/English
  editions all exist online) and needs to be sourced/ingested as the seed content.
- Chosen over 오디세이아 (shorter, also public domain, was the other finalist) because the
  operator explicitly found this one more appealing, despite being the much bigger undertaking —
  hundreds of characters, 100+ chapters worth of political intrigue and war, closer in tone to
  Game of Thrones than the Odyssey's episodic monster-of-the-week adventure structure.

### Other candidates discussed, for later books

**Free / public domain:**
- Closest in tone to 삼국지 (political intrigue + war + large cast): 초한지 (Chu-Han Contention),
  열국지 (Chinese Spring/Autumn & Warring States), 수호전 (Water Margin), 헤이케 이야기
  (平家物語, often called "Japan's Three Kingdoms"), 플루타르코스 영웅전, 갈리아 전쟁기
  (Caesar), 아이반호.
- Other classics considered: 몬테크리스토 백작, 레미제라블, 전쟁과 평화, 카라마조프가의
  형제들, 돈키호테, 서유기, 사기(史記), 아라비안 나이트, 오디세이아, 일리아드.

**Paid / in-copyright (operator would need to buy an ebook first):**
- 듄, 왕좌의 게임(얼음과 불의 노래), 반지의 제왕, 대망(도쿠가와 이에야스/도요토미 히데요시
  사가), 은하영웅전설, 미스트본/스톰라이트 아카이브(브랜든 샌더슨), 김용 무협(사조영웅전 등),
  해리포터.

## Architecture plan — mirrors Wordflow's content pipeline

See `../wordflow/src/lib/generateReading.ts` and `../wordflow/src/db/schema.ts` for the reference
implementation this is modeled on. Key pattern to reuse:

- Source text → Claude Haiku rewrite pass → stored per content-unit (Wordflow: per curriculum
  chapter; here: per book chapter/section) → a cursor per reader walks through content-units in
  order → daily/on-demand reveal + TTS.
- **Difference from Wordflow:** Wordflow's source text comes from a live, licensed API (NLT) fetched
  by reference at generation time. Storyflow has no equivalent API for arbitrary novel text — the
  full source text needs to be sourced/ingested once up front (public-domain text dump for 삼국지),
  then chunked into chapter-sized units for the same per-unit Claude rewrite step.
- Single-reader app — none of Wordflow's multi-profile/Google-OAuth/Stripe-billing/admin-panel
  complexity is needed here unless that scope changes later (see legal-scope note above).
- Advisory-lock-guarded generation, content-is-a-pure-function-of-the-chapter caching, and the
  prefetch-one-ahead pattern from Wordflow are all reusable ideas even for a single-user app if
  generation latency turns out to matter.

## UI/UX decisions (locked in 2026-07-24)

- **No "Today" tab.** Unlike Wordflow's Today + Reading split, Storyflow has a single flow:
  Library (book grid) → book detail (chapter grid + resume button) → chapter reading view. No
  daily-advancing cursor, no curriculum concept — a chapter is just read whenever the reader opens
  it.
- **Bookmark, not a daily cursor.** Each reader has one "last read chapter" pointer per book
  (`bookmarks` table), updated whenever a chapter page loads. This is a pure position marker, not
  Wordflow's auto-advancing Today cursor.
- **Theme:** explicitly NOT the oriental/삼국지-themed palette that would've been the obvious
  choice — operator said 삼국지 is just the first book and future books span other
  genres/settings, and the app should read as a generic modern book-reading app. Went with a
  neutral cream/warm-gray paper + deep indigo accent (see `src/app/globals.css`) instead of
  Wordflow's warm clay/parchment palette. CSS variable *names* were kept identical to Wordflow's
  (`--clay`, `--clay-deep`, `--clay-tint`, `--gold`, etc.) even though the hues changed, so
  TTS/nav components ported over verbatim needed zero edits.
- **Bilingual content, both "쉬운" style.** Every chapter gets a Korean AND English easy/engaging
  retelling (mirrors Wordflow's `bilingualField` pattern in `generateObject` calls) — not
  Korean-only.
- **Identity: name only, no OAuth/password.** `readers` table keyed by unique name, claimed via
  `POST /api/reader`; the client just remembers `{id, name}` in localStorage
  (`src/app/ReaderProvider.tsx`). This is deliberately the same lightweight scheme Wordflow used
  *before* Auth.js was added — the whole point is: type your name once, and progress follows you
  across devices (desktop + phone Safari) via the DB, without any password to manage. No
  Google login, no billing, no admin panel, no multi-profile complexity — confirmed against the
  legal-scope note above (personal single-user app).
- **Safari web app (PWA).** Installable to iOS home screen — `manifest.ts`, generative icon
  (`src/lib/appIcon.tsx`, an open-book mark in the indigo palette), `apple-web-app` meta in
  `layout.tsx`, `standalone` display mode. Same pattern as Wordflow's PWA setup.
- **TTS/audio: ported near-verbatim from Wordflow** (`src/lib/speak.ts`,
  `src/app/PlaybackProvider.tsx`, `src/app/NowPlayingBar.tsx`) — chunked sentence-level playback,
  click-to-seek highlighting, Media Session integration for lock-screen controls, AI Gateway TTS
  route with Vercel Blob caching (`src/app/api/speak/route.ts`). This was an explicit ask: "오디오
  듣고 하는 모든 기술들은 다 wordflow 따라하면 되고... wordflow 랑 동일한 경험감을 가지면 좋겠어."
- **App UI chrome is English by default, Korean available in Settings** — a later ask in the same
  session ("ui는 영어로. 셋팅에 한영 선택 버튼 넣어주고"). This is a THIRD, independent language
  axis on top of the two already in play: (1) UI chrome (buttons/labels/nav — `src/lib/i18n.ts`,
  `src/app/UiLanguageProvider.tsx`, defaults `"en"`, toggle lives in `/settings`), (2) chapter
  story-text language (the ko/en toggle on the reading page itself, per-chapter, unrelated to UI
  chrome), (3) the content-*generation* language, which is always both (every chapter is generated
  bilingual regardless of any UI setting — see "Bilingual content" above). Don't conflate these
  three when touching language-related code.
- **Font-size setting, ported from Wordflow** (`src/lib/fontScale.ts`,
  `src/app/FontScaleProvider.tsx`) — same `--font-scale` CSS var mechanism, same 6-step scale,
  same inline `<head>` script in `layout.tsx` to apply it before first paint (avoids a flash of
  default-size text). Lives in `/settings` alongside the UI language toggle.

## Infrastructure (provisioned 2026-07-24)

- **Vercel project**: `sl-studio/storyflow`, linked (`.vercel/project.json`), same team as
  Wordflow and the operator's other apps. GitHub repo auto-connected for deploys.
- **Database**: Neon Postgres via the Vercel Marketplace integration (`neon-cordovan-branch`),
  `DATABASE_URL` (+ related `PG*`/`POSTGRES_*` vars) set across Production/Preview/Development in
  Vercel and pulled into `.env.local`. Migrations applied (`drizzle/0000_*.sql`,
  `drizzle/0001_*.sql` — the latter adds `books.descriptionEn`), and the `samgukji` placeholder
  book row is seeded. Verified end-to-end with a local `next dev` smoke test hitting
  `/api/books` and `/api/reader` against the real DB (see git/session history, not repeated here).
- **No AUTH_SECRET or auth-related env vars** — the generic Vercel bootstrap flow normally
  generates one, but this app has no auth (see "Identity: name only" above), so that step was
  deliberately skipped.

## Architecture as actually built (2026-07-24 scaffold)

- `src/db/schema.ts`: `readers` (name-only identity), `books` (generic — not 삼국지-specific;
  `totalChapters` nullable until ingestion), `chapters` (`sourceText` = raw ingested original,
  `story{Ko,En}`/`title{Ko,En}` = Claude-rewritten bilingual retelling, `generatedAt` null =
  not-yet-generated), `bookmarks` (one row per reader×book).
- `src/lib/generateChapter.ts`: `ensureChapterContent(chapterId)` — lazy-generates a chapter's
  bilingual retelling on first read and caches forever, advisory-lock-guarded per chapter. Direct
  port of Wordflow's generate-once-cache-forever pattern from `generateReading.ts`, simplified
  (no curriculum cursor, no season logic, no prefetch-ahead buffer — this app has no
  daily-advancing concept for those to serve).
- API routes: `GET /api/books` (library list + per-reader bookmark), `GET /api/books/[slug]`
  (book detail + chapter list), `GET /api/books/[slug]/chapters/[chapterNumber]` (lazy-generates
  and returns one chapter, plus prev/next flags), `POST /api/bookmarks` (upsert),
  `POST /api/reader` (claim/create identity by name).
- Cost estimate for generating a whole book (discussed 2026-07-24, using Haiku 4.5 pricing
  $1/$5 per MTok): 삼국지 has ~120 chapters vs. the Bible's ~1,189 chapter-complete curriculum
  Wordflow already generates cheaply — even with longer/bilingual per-chapter output, total
  one-time generation cost was estimated at low single-digit to ~$10, not a concern.

## Source text: 삼국지 원문 (ingested 2026-07-24)

Used the **Chinese original** (Luo Guanzhong's 三國志演義), not an English translation —
Project Gutenberg ebook #23950 (`gutenberg.org/ebooks/23950`), "Public domain in the USA." Picked
over the well-known Brewitt-Taylor English translation because that one is split across two
Gutenberg volumes and only volume 1 (chapters 1-60, ebook #77416) could be located; the Chinese
original is a single complete file covering all 120 chapters. Claude reads classical Chinese well
enough to ground the bilingual (Korean+English) rewrite directly from it — see
`src/lib/generateChapter.ts`'s system prompt, and the quality check below.

- Raw file: `data/samgukji-source.txt` (committed to the repo — small, public domain, and having
  it in-repo makes the ingestion step reproducible without re-downloading).
- Ingestion script: `src/db/ingestSamgukji.ts` (`npm run db:ingest-samgukji`) — splits on the
  text's own `第N回：<heading>` chapter markers (120 matches, chapter numerals aren't parsed, just
  counted in document order), inserts one `chapters` row per chapter with `sourceTitle` +
  `sourceText`, and sets `books.totalChapters = 120`. Idempotent: re-running skips chapters that
  already have a row (matched by `(bookId, chapterNumber)`), so it's safe to re-run after an
  unrelated schema change.
- **Already run against the real (Neon) DB** — all 120 chapters are ingested with
  `generatedAt: null` (i.e., raw source present, bilingual retelling not yet generated — that
  still happens lazily per-chapter on first read, per `ensureChapterContent`).

### Pipeline verified end-to-end with a real Claude call (2026-07-24)

Generated chapter 1 live via `GET /api/books/samgukji/chapters/1` against the deployed Neon DB.
Confirmed: (a) the advisory-lock-guarded lazy-generation path works and persists correctly —
`generatedAt` gets set and the content survives a re-fetch instantly from cache; (b) output
quality is good in both languages — faithful to the source plot (Yellow Turban Rebellion, the
Oath of the Peach Garden, Liu Bei/Guan Yu/Zhang Fei introduced), easy accessible prose, not a
summary. **First-generation latency for one chapter was ~30-60s** in local `next dev` (a
standalone script calling the same `generateObject` call directly took ~18s for a similar-sized
chapter — the gap is Next.js dev/Turbopack overhead, not a pipeline problem). Don't be alarmed by
a slow first response to an ungenerated chapter; that's expected and one-time per chapter.

Only chapter 1 has been generated so far (lazy — the other 119 generate on first read, exactly as
designed). Bulk-pregenerating all 120 was **not** done — that's a real per-run decision (time:
~30-60s × 119 sequentially, or faster in parallel; cost: see the Haiku pricing estimate above,
still low) that should be a deliberate choice, not something done silently in passing.

## Sentence-level resume position (added 2026-07-24, post-deploy)

Follow-up ask after the first production deploy: "북마크는 어떻게 해?" → chapter-level bookmarking
existed, but chapters run long and re-listening/re-reading from the top every time isn't
acceptable. Added in-chapter sentence position on top of the existing chapter-level bookmark:

- `bookmarks.chunkIndex` + `bookmarks.lang` (migration `0002`) — indexes into
  `splitIntoChunks(storyKo|storyEn)` for whichever language it was recorded in. Korean/English
  chunk counts differ (independent retellings, not aligned translations), so a chunkIndex is only
  meaningful paired with its own `lang` — never interpret one without the other.
- Written from two places on the chapter page: (a) live, whenever TTS or a sentence click moves
  `activeChunkIndex` while that chapter is the one playing; (b) implicitly preserved-or-reset by
  `POST /api/bookmarks` itself — see the reset-on-different-chapter / preserve-on-same-chapter
  logic in `src/app/api/bookmarks/route.ts`, verified with a manual request sequence during this
  session (open ch. 2 → set position → reopen ch. 2 without a position → position survives; open
  ch. 1 → position resets to null).
- Read back via `GET /api/books/[slug]/chapters/[chapterNumber]?readerId=` → `resume` field, only
  populated when the bookmark's `chapterNumber` matches the chapter being requested. The chapter
  page uses it to: default the language toggle to the language it was recorded in (not the
  device's last global choice), mark that sentence visually (🔖 + border, distinct from the
  live-playback highlight), scroll it into view on load, and use it as the default TTS start
  index when the reader taps 🔊 fresh instead of clicking a specific sentence.
- Deliberately does **not** cover silent scrolling/reading with zero TTS or sentence-click
  interaction — there's no scroll-position tracking, only chunk-index tracking tied to actual
  playback/click events. A reader who scrolls through a chapter without ever pressing play or
  clicking a sentence still won't get a resume marker. Flagged here rather than silently
  scoped out, in case that gap matters enough later to add scroll-based tracking too.

## Status

- 2026-07-24: Idea scoped, first book picked (삼국지). Repo created at
  https://github.com/slee8495/storyflow — pushed public (operator OK'd this; the personal-use-only
  constraint above is about the *app/service* not being distributed or monetized, not about the
  code being visible — same as how Wordflow's repo is also public).
  **The app is fully built, infra-provisioned, content-ingested, and verified working
  end-to-end against the real production database**, including one real Claude-generated
  chapter. Nothing scoped for this session remains outstanding. See "Architecture as actually
  built", "Infrastructure", and "Source text" above for what exists and how it was verified.
  **Deployed to production**: pushed to `main` (GitHub-connected → Vercel auto-build, ~29s,
  succeeded) — **live at https://storyflow-pied.vercel.app**. Verified live: `/` and `/api/books`
  both 200, correctly reading from the same Neon DB (120-chapter 삼국지 metadata + the one
  already-generated chapter 1 both show up in production, no separate seeding needed since it's
  the same `DATABASE_URL` across environments).
  Possible next steps (none committed to yet — bring back to the operator before doing any of
  these): pre-generate more/all chapters ahead of time instead of lazily; source a second book;
  review generation quality across a wider sample of chapters (only chapter 1 has been read so
  far); try it as an installed Safari PWA on a phone against the production URL above.

## For the next Claude session picking this up

Read this whole file first — it's the complete context, nothing important was discussed outside
of it. **This is a complete, working, deployed-infra app as of 2026-07-24** — not a from-scratch
or partial build. Before assuming something is missing or broken, check "Status" above and verify
against the live Neon DB / Vercel project rather than re-deriving from just reading source files.
The repo has no *required* next step right now — treat any further work as the operator's explicit
new ask, not an inferred TODO. Don't add auth, billing, multi-user, or public-facing deployment
features without first re-confirming the licensing/personal-use constraint above with the operator
— that scope hasn't changed as of this writing.
