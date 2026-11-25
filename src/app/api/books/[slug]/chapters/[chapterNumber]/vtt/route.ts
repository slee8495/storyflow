import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { books, chapters, chapterFilms } from "@/db/schema";
import { cuesToVtt } from "@/lib/filmVtt";

// Subtitle track for the chapter film's <track> — served from the app's own origin (a <track>
// from another origin needs CORS on the video too) so the phone's full-screen player can show it.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ slug: string; chapterNumber: string }> }) {
  const { slug, chapterNumber } = await params;
  const n = Number(chapterNumber);
  if (!Number.isInteger(n) || n < 1) return NextResponse.json({ error: "invalid chapter number" }, { status: 400 });
  const [film] = await db
    .select({ cues: chapterFilms.cues })
    .from(chapterFilms)
    .innerJoin(chapters, eq(chapters.id, chapterFilms.chapterId))
    .innerJoin(books, eq(books.id, chapters.bookId))
    .where(and(eq(books.slug, slug), eq(chapters.chapterNumber, n), eq(chapterFilms.status, "ready")))
    .limit(1);
  return new NextResponse(cuesToVtt(film?.cues), {
    headers: { "Content-Type": "text/vtt; charset=utf-8", "Cache-Control": "private, max-age=600" },
  });
}
