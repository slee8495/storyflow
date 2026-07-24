import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { books, bookmarks } from "@/db/schema";
import { computeChapterFraction, computeOverallProgressPct, projectCompletion } from "@/lib/progress";

// Reader-facing progress readout for one book: how far into the current chapter, how far into
// the whole book, and — given at least a couple of days of reading history — a trailing-pace
// projection of the completion date. See src/lib/progress.ts for the math; this route just reads.
export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const readerId = Number(req.nextUrl.searchParams.get("readerId") ?? "");
  if (!readerId) return NextResponse.json({ error: "readerId is required" }, { status: 400 });

  const [book] = await db.select().from(books).where(eq(books.slug, slug)).limit(1);
  if (!book) return NextResponse.json({ error: "book not found" }, { status: 404 });

  const [mark] = await db
    .select()
    .from(bookmarks)
    .where(and(eq(bookmarks.readerId, readerId), eq(bookmarks.bookId, book.id)))
    .limit(1);

  if (!mark) {
    return NextResponse.json({
      started: false,
      chapterNumber: null,
      totalChapters: book.totalChapters,
      currentChapterPct: 0,
      overallPct: 0,
      projected: null,
    });
  }

  const lang = mark.lang as "ko" | "en" | null;
  const chapterFraction = await computeChapterFraction(book.id, mark.chapterNumber, mark.chunkIndex, lang);
  const overallPct = await computeOverallProgressPct(book, mark.chapterNumber, mark.chunkIndex, lang);
  const projected = await projectCompletion(readerId, book.id, overallPct);

  return NextResponse.json({
    started: true,
    chapterNumber: mark.chapterNumber,
    totalChapters: book.totalChapters,
    currentChapterPct: Math.round(chapterFraction * 100),
    overallPct: Math.round(overallPct * 10) / 10,
    projected,
  });
}
