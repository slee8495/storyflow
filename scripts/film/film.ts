// "영상으로 보기" chapter films — runs on the operator's Mac (launchd every 4 hours, see
// scripts/film/film.sh), never on Vercel. Ported from Wordflow's scripts/film/nightly.ts.
//
// 2026-11-24 user: "내가 멈춘 장 바로 그 다음장부터 영상 담아주면 되는거야" — ONE chapter at a time:
// 1. Where is the operator? Their most recently touched bookmark (the book they're on, the chapter
//    and sentence they stopped at). The target is the next chapter — or, if they're listening right
//    now, the first chapter narration can't carry them into before the film is done (see
//    src/lib/filmTarget.ts).
// 2. If that chapter has no ready film: reuse its saved script, or ask `claude -p` once for one
//    (scene cuts as chunk ranges + image prompts); narrate each chunk with the app's own
//    /api/speak voice; render stills + motion locally (render.py, mflux — free); upload to Blob;
//    mark it ready. Just before publishing, check the bookmark again: if the reader got to that
//    chapter while it was being made, it's not published (they've moved on) and the next run
//    aims past them.
// 3. Every other ready film — except the one for the chapter the reader is in right now — has its
//    video deleted; the script stays, so coming back to a chapter only re-renders it.
//
// While a film is ready, the chapter before it stops narration at its end (nextReady in the
// chapter route), so the reader always arrives at the film rather than past it.
//
// Usage: npx tsx --env-file=.env.local scripts/film/film.ts [--chapter <chapterId>] [--dry]
// FILM_ALLOW_CLAUDE=0 (set by film.sh when the control tower says skip) → no new scripts this run.
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { and, asc, desc, eq, gt, inArray, notInArray } from "drizzle-orm";
import { del, put } from "@vercel/blob";
import { db } from "@/db";
import { bookmarks, books, chapterFilms, chapters, readers, type Chapter, type FilmScript } from "@/db/schema";
import { speechRequestUrls, splitIntoChunks } from "@/lib/speak";
import { pickFilmChapter } from "@/lib/filmTarget";

const READER = process.env.FILM_READER ?? "SL";
const SKIP_BOOKS = ["art-tour"]; // a tour of real paintings — its pictures are the point
const HOME = path.join(os.homedir(), ".slstudio/storyflow-film");
const WORK = path.join(HOME, "work");
const PY = process.env.FILM_PYTHON ?? path.join(os.homedir(), ".slstudio/wordflow-film/venv/bin/python");
const BASE_URL = process.env.FILM_BASE_URL ?? "https://storyflow-pied.vercel.app";
const CLAUDE = process.env.CLAUDE_BIN ?? "claude";
// Listening that must lie between the reader and the film while they're listening (≈ how long a
// film takes to make), and how recent a bookmark write counts as "listening right now" — narration
// saves the position every sentence chunk (~30s).
const LEAD_SEC = Number(process.env.FILM_LEAD_SEC ?? 3600);
const ACTIVE_MS = 5 * 60 * 1000;
const SECONDS_PER_CHAR = { ko: 0.16, en: 0.069 } as const; // src/lib/progress.ts

const DEFAULT_STYLE =
  "Photorealistic cinematic film still, shot on ARRI Alexa 65 with anamorphic lens, historically accurate " +
  "period setting and costume, natural skin texture, real fabric and wear, natural light, muted color grade, " +
  "subtle film grain, prestige period drama, simple uncluttered composition";

const log = (...a: unknown[]) => console.log(new Date().toISOString().slice(5, 16), ...a);
const sha = (s: string) => createHash("sha1").update(s).digest("hex");

// ---------- where the reader is ----------

type Position = { bookId: number; slug: string; chapterNumber: number; chunkIndex: number | null; lang: "ko" | "en" | null; updatedAt: Date };

async function readerPosition(): Promise<Position | null> {
  const rows = await db
    .select({
      bookId: bookmarks.bookId,
      slug: books.slug,
      chapterNumber: bookmarks.chapterNumber,
      chunkIndex: bookmarks.chunkIndex,
      lang: bookmarks.lang,
      updatedAt: bookmarks.updatedAt,
    })
    .from(bookmarks)
    .innerJoin(readers, eq(readers.id, bookmarks.readerId))
    .innerJoin(books, eq(books.id, bookmarks.bookId))
    .where(eq(readers.name, READER))
    .orderBy(desc(bookmarks.updatedAt))
    .limit(5);
  const p = rows.find((r) => !SKIP_BOOKS.includes(r.slug));
  return p ? { ...p, lang: p.lang === "en" || p.lang === "ko" ? p.lang : null } : null;
}

const listenSec = (text: string | null, lang: "ko" | "en") => (text ? text.length * SECONDS_PER_CHAR[lang] : null);

async function computeTarget(pos: Position): Promise<Chapter | null> {
  const lang = pos.lang ?? "ko";
  const [current] = await db
    .select()
    .from(chapters)
    .where(and(eq(chapters.bookId, pos.bookId), eq(chapters.chapterNumber, pos.chapterNumber)))
    .limit(1);
  const upcoming = await db
    .select()
    .from(chapters)
    .where(and(eq(chapters.bookId, pos.bookId), gt(chapters.chapterNumber, pos.chapterNumber)))
    .orderBy(asc(chapters.chapterNumber))
    .limit(12);
  const currentText = current ? (lang === "en" ? current.storyEn : current.storyKo) : null;
  const rest = currentText ? splitIntoChunks(currentText).slice((pos.chunkIndex ?? -1) + 1).join("") : "";
  const active = Date.now() - pos.updatedAt.getTime() < ACTIVE_MS;
  const n = pickFilmChapter({
    remainingSecInCurrent: rest.length * SECONDS_PER_CHAR[lang],
    upcoming: upcoming.map((c) => ({
      chapterNumber: c.chapterNumber,
      // Korean is what the film narrates, but the lead is measured in the language they listen in.
      listenSec: c.generatedAt && c.storyKo ? listenSec(lang === "en" ? c.storyEn : c.storyKo, lang) : null,
    })),
    leadSec: active ? LEAD_SEC : 0,
  });
  if (active) log(`reader is listening now (${pos.slug} ${pos.chapterNumber}) — aiming ${LEAD_SEC / 60} min ahead`);
  return upcoming.find((c) => c.chapterNumber === n) ?? null;
}

// ---------- script (the only Claude step) ----------

function claudeJson(prompt: string): unknown {
  const res = spawnSync(CLAUDE, ["-p", prompt, "--model", "opus", "--output-format", "text"], {
    encoding: "utf8",
    maxBuffer: 20 * 1024 * 1024,
    timeout: 20 * 60 * 1000,
  });
  if (res.status !== 0) throw new Error(`claude -p failed: ${res.stderr?.slice(0, 500)}`);
  const s = res.stdout;
  const a = s.indexOf("{");
  const b = s.lastIndexOf("}");
  if (a < 0 || b < a) throw new Error("claude -p returned no JSON");
  return JSON.parse(s.slice(a, b + 1));
}

async function bookStyle(bookId: number): Promise<string | null> {
  const [prev] = await db
    .select({ script: chapterFilms.script })
    .from(chapterFilms)
    .innerJoin(chapters, eq(chapters.id, chapterFilms.chapterId))
    .where(eq(chapters.bookId, bookId))
    .orderBy(desc(chapterFilms.updatedAt))
    .limit(1);
  return prev?.script.style ?? null;
}

async function writeScript(ch: Chapter, bookTitle: string, chunks: string[]): Promise<FilmScript> {
  const style = await bookStyle(ch.bookId);
  const prompt = [
    `You are the director of a photorealistic film of one chapter of "${bookTitle}" (chapter ${ch.chapterNumber}: ${ch.titleKo ?? ""}) for a personal reading app. The film is a sequence of still images with slow camera motion; the Korean narration below is read over it, unchanged.`,
    `The narration, already split into numbered chunks:\n${chunks.map((c, i) => `[${i}] ${c}`).join("\n")}`,
    `Cut it into consecutive scenes: each scene starts at a chunk number and runs until the next scene starts. The first scene starts at 0. Aim for one scene per 2-3 chunks (${Math.max(4, Math.min(20, Math.round(chunks.length / 2.5)))} scenes or so; never more than 20), cutting where the picture should change — a new place, a new moment, a new person speaking.`,
    `For each scene write an English image prompt for a photorealistic still (an AI image model will render it): one concrete, filmable moment — who, where, action, light, camera framing. Historically accurate setting and costume for this book's place and era. Real people, never cartoon. Describe only what IS in the frame; never write "no X" (the image model adds anything you name). Keep recurring characters described the same way in every scene (age, hair, build, clothing). Keep violence implied, never gore. Romance or sex: show only a fully clothed, non-sexual moment around it (a glance, hands, an empty candle-lit room, a closed door, a landscape) — never nudity or intimacy.`,
    style
      ? `The film's visual style string, shared by every chapter of this book — return it unchanged: ${style}`
      : `Also write the film's visual style string: start from this and adapt the place/era for this book: ${DEFAULT_STYLE}`,
    `Reply with ONLY this JSON: {"title": "<short Korean title for this chapter's film>", "style": "<style string>", "scenes": [{"from": <first chunk number>, "prompt": "<English image prompt>"}]}`,
  ].join("\n\n");

  const raw = claudeJson(prompt) as { title?: string; style?: string; scenes?: { from?: number; prompt?: string }[] };
  const scenes = (raw.scenes ?? []).filter((s) => Number.isInteger(s.from) && s.prompt?.trim());
  if (scenes.length < 2) throw new Error("script has too few scenes");
  if (scenes[0].from !== 0) throw new Error("first scene must start at chunk 0");
  for (let i = 1; i < scenes.length; i++) {
    if (scenes[i].from! <= scenes[i - 1].from! || scenes[i].from! >= chunks.length) throw new Error("scene cuts out of order");
  }
  return {
    title: raw.title?.trim() || ch.titleKo || `${ch.chapterNumber}장`,
    style: style ?? (raw.style?.trim() || DEFAULT_STYLE),
    scenes: scenes.map((s, i) => ({
      from: s.from!,
      to: i + 1 < scenes.length ? scenes[i + 1].from! : chunks.length,
      prompt: s.prompt!.trim(),
      seed: 100 + i,
    })),
  };
}

// ---------- narration ----------

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// The exact /api/speak request the app makes for this chunk, so it's the same voice (and, once the
// app's TTS cache is warm, the same file).
async function narrate(url: string, dir: string): Promise<string> {
  const file = path.join(dir, sha(url).slice(0, 16) + ".mp3");
  if (fs.existsSync(file)) return file;
  for (let attempt = 0; attempt < 6; attempt++) {
    const res = await fetch(BASE_URL + url, { redirect: "follow" }).catch(() => null);
    if (res?.ok && (res.headers.get("content-type") ?? "").includes("audio")) {
      fs.writeFileSync(file, Buffer.from(await res.arrayBuffer()));
      await sleep(500);
      return file;
    }
    log(`  tts ${res?.status ?? "network error"}, retrying`);
    await sleep(res?.status === 429 ? 30000 : 5000);
  }
  throw new Error(`tts failed for ${url.slice(0, 80)}`);
}

// ---------- render + upload ----------

async function render(ch: Chapter, script: FilmScript, chunks: string[]) {
  const wd = path.join(WORK, String(ch.id));
  const ttsDir = path.join(wd, "tts");
  fs.mkdirSync(ttsDir, { recursive: true });
  // A changed script must not reuse stills drawn from the old prompts.
  const sig = sha(JSON.stringify(script));
  const sigFile = path.join(wd, "script.sig");
  if (fs.existsSync(sigFile) && fs.readFileSync(sigFile, "utf8") !== sig) {
    fs.rmSync(path.join(wd, "images"), { recursive: true, force: true });
  }
  fs.writeFileSync(sigFile, sig);

  const urls = speechRequestUrls(ch.storyKo!);
  if (urls.length !== chunks.length) throw new Error("chunk count mismatch");
  const scenes = [];
  for (const sc of script.scenes) {
    const segments = [];
    for (let i = sc.from; i < sc.to; i++) segments.push({ chunk: i, text: chunks[i], audio: await narrate(urls[i], ttsDir) });
    scenes.push({ prompt: sc.prompt, seed: sc.seed, segments });
  }
  const plan = { workdir: wd, title: `${ch.chapterNumber}장 · ${script.title}`, style: script.style, scenes };
  const planFile = path.join(wd, "plan.json");
  fs.writeFileSync(planFile, JSON.stringify(plan, null, 1));
  const r = spawnSync(PY, [path.join(__dirname, "render.py"), planFile], { stdio: "inherit" });
  if (r.status !== 0) throw new Error("render.py failed");
  return wd;
}

async function upload(ch: Chapter, wd: string) {
  const stamp = Date.now();
  // Random suffix: the store is public, so the URL itself is what keeps the film unlisted.
  const video = await put(`storyflow-films/${ch.id}/${stamp}.mp4`, fs.createReadStream(path.join(wd, "film.mp4")), {
    access: "public",
    contentType: "video/mp4",
    multipart: true,
    addRandomSuffix: true,
    cacheControlMaxAge: 31536000,
  });
  const poster = await put(`storyflow-films/${ch.id}/${stamp}.jpg`, fs.readFileSync(path.join(wd, "poster.jpg")), {
    access: "public",
    contentType: "image/jpeg",
    addRandomSuffix: true,
    cacheControlMaxAge: 31536000,
  });
  const cues = JSON.parse(fs.readFileSync(path.join(wd, "cues.json"), "utf8"));
  const { durationSec } = JSON.parse(fs.readFileSync(path.join(wd, "meta.json"), "utf8"));
  return { videoUrl: video.url, posterUrl: poster.url, cues, durationSec };
}

// ---------- main ----------

// Has the reader reached `ch` (or gone past it) since we started? Then a film of it is moot.
async function readerReached(ch: Chapter): Promise<boolean> {
  const pos = await readerPosition();
  return !!pos && pos.bookId === ch.bookId && pos.chapterNumber >= ch.chapterNumber;
}

async function makeFilm(ch: Chapter, allowClaude: boolean, dry: boolean): Promise<"ready" | "made" | "skipped" | "moot"> {
  const [book] = await db.select().from(books).where(eq(books.id, ch.bookId)).limit(1);
  const label = `${book?.slug} ${ch.chapterNumber}`;
  if (!ch.storyKo) return log(`skip    ${label} (no Korean text)`), "skipped";
  const textSig = sha(ch.storyKo);
  const chunks = splitIntoChunks(ch.storyKo);
  const [film] = await db.select().from(chapterFilms).where(eq(chapterFilms.chapterId, ch.id)).limit(1);
  if (film?.status === "ready" && film.videoUrl && film.textSig === textSig) return log(`ready   ${label}`), "ready";
  const hasScript = film && film.textSig === textSig;
  if (dry) return log(`todo    ${label} (${hasScript ? "has script" : "needs script"})`), "skipped";

  let script = hasScript ? film.script : null;
  if (!script) {
    if (!allowClaude) return log(`skip    ${label} (needs a script, Claude not allowed this run)`), "skipped";
    log(`script  ${label} (${chunks.length} chunks)`);
    script = await writeScript(ch, book?.title ?? "", chunks);
    await db
      .insert(chapterFilms)
      .values({ chapterId: ch.id, status: "archived", textSig, script })
      .onConflictDoUpdate({ target: chapterFilms.chapterId, set: { script, textSig, status: "archived", updatedAt: new Date() } });
  }
  log(`render  ${label} (${script.scenes.length} scenes)`);
  const wd = await render(ch, script, chunks);
  if (await readerReached(ch)) {
    log(`moot    ${label} — the reader got there while it was being made; not publishing`);
    return "moot";
  }
  const out = await upload(ch, wd);
  if (await readerReached(ch)) {
    await del([out.videoUrl, out.posterUrl]).catch(() => {});
    log(`moot    ${label} — the reader got there during upload; not publishing`);
    return "moot";
  }
  await db.update(chapterFilms).set({ status: "ready", ...out, updatedAt: new Date() }).where(eq(chapterFilms.chapterId, ch.id));
  // Clips are big and only needed until upload; stills + narration stay for a cheap re-render.
  fs.rmSync(path.join(wd, "clips"), { recursive: true, force: true });
  fs.rmSync(path.join(wd, "film.mp4"), { force: true });
  log(`done    ${label} ${Math.round(out.durationSec)}s`);
  return "made";
}

// Every ready film except `keepIds` loses its video (the script stays).
async function purge(keepIds: number[], dry: boolean) {
  const stale = await db
    .select()
    .from(chapterFilms)
    .where(
      keepIds.length
        ? and(eq(chapterFilms.status, "ready"), notInArray(chapterFilms.chapterId, keepIds))
        : eq(chapterFilms.status, "ready"),
    );
  for (const f of stale) {
    log(`archive chapter ${f.chapterId}`);
    if (dry) continue;
    const urls = [f.videoUrl, f.posterUrl].filter((u): u is string => !!u);
    if (urls.length) await del(urls).catch((e) => log("  blob delete failed", String(e)));
    await db
      .update(chapterFilms)
      .set({ status: "archived", videoUrl: null, posterUrl: null, cues: null, updatedAt: new Date() })
      .where(eq(chapterFilms.id, f.id));
    fs.rmSync(path.join(WORK, String(f.chapterId)), { recursive: true, force: true });
  }
}

async function main() {
  const args = process.argv.slice(2);
  const dry = args.includes("--dry");
  const allowClaude = process.env.FILM_ALLOW_CLAUDE !== "0";
  const only = args.includes("--chapter") ? Number(args[args.indexOf("--chapter") + 1]) : null;

  if (only) {
    const [ch] = await db.select().from(chapters).where(inArray(chapters.id, [only]));
    if (!ch) throw new Error(`chapter ${only} not found`);
    await makeFilm(ch, allowClaude, dry);
    process.exit(0);
  }

  // Two tries: if the reader overtakes the first film while it's being made, aim past them again.
  for (let attempt = 0; attempt < 2; attempt++) {
    const pos = await readerPosition();
    if (!pos) return log(`no bookmark for reader ${READER}`), process.exit(0);
    const target = await computeTarget(pos);
    const [current] = await db
      .select({ id: chapters.id })
      .from(chapters)
      .where(and(eq(chapters.bookId, pos.bookId), eq(chapters.chapterNumber, pos.chapterNumber)))
      .limit(1);
    // The film of the chapter they're in right now stays, so it doesn't vanish mid-watch.
    const keep = [target?.id, current?.id].filter((id): id is number => !!id);
    log(`reader at ${pos.slug} ${pos.chapterNumber}${pos.chunkIndex !== null ? `:${pos.chunkIndex}` : ""} → film ${target ? target.chapterNumber : "none (next chapter not translated yet)"}`);
    await purge(keep, dry);
    if (!target) break;
    const result = await makeFilm(target, allowClaude, dry);
    if (result !== "moot") break;
  }
  process.exit(0);
}

main().catch((e) => {
  log("FAILED", e instanceof Error ? e.message : e);
  process.exit(1);
});
