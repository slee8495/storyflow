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

## Status

- 2026-07-24: Idea scoped, first book picked (삼국지), this repo/folder just created. No code yet —
  next steps are sourcing a full 삼국지 text and deciding the tech stack (can reuse Wordflow's
  Next.js/Drizzle stack, or go simpler given single-user/no-billing scope).
