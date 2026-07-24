import { NextRequest, NextResponse } from "next/server";
import { eq, and, asc } from "drizzle-orm";
import { db } from "@/db";
import { books, chapters, bookmarks } from "@/db/schema";

// Book detail: metadata + the full chapter list (number/title only, not the generated story text
// — that's fetched per-chapter lazily, see [chapterNumber]/route.ts) + the reader's bookmark.
export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const readerId = Number(req.nextUrl.searchParams.get("readerId") ?? "");

  const [book] = await db.select().from(books).where(eq(books.slug, slug)).limit(1);
  if (!book) return NextResponse.json({ error: "book not found" }, { status: 404 });

  const chapterList = await db
    .select({
      id: chapters.id,
      chapterNumber: chapters.chapterNumber,
      sourceTitle: chapters.sourceTitle,
      titleKo: chapters.titleKo,
      titleEn: chapters.titleEn,
      generatedAt: chapters.generatedAt,
    })
    .from(chapters)
    .where(eq(chapters.bookId, book.id))
    .orderBy(asc(chapters.chapterNumber));

  let bookmarkChapter: number | null = null;
  if (readerId) {
    const [mark] = await db
      .select()
      .from(bookmarks)
      .where(and(eq(bookmarks.readerId, readerId), eq(bookmarks.bookId, book.id)))
      .limit(1);
    bookmarkChapter = mark?.chapterNumber ?? null;
  }

  return NextResponse.json({ book, chapters: chapterList, bookmarkChapter });
}
