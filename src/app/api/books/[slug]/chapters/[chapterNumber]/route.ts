import { NextRequest, NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import { books, chapters } from "@/db/schema";
import { ensureChapterContent } from "@/lib/generateChapter";

// Returns one chapter's bilingual retelling, generating it on first read (see
// ensureChapterContent) and reusing the cached version on every later read. Also returns
// prev/next chapter numbers so the reading page can render its own navigation without a second
// request.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string; chapterNumber: string }> },
) {
  const { slug, chapterNumber } = await params;
  const chapterNum = Number(chapterNumber);
  if (!Number.isInteger(chapterNum) || chapterNum < 1) {
    return NextResponse.json({ error: "invalid chapter number" }, { status: 400 });
  }

  const [book] = await db.select().from(books).where(eq(books.slug, slug)).limit(1);
  if (!book) return NextResponse.json({ error: "book not found" }, { status: 404 });

  const [row] = await db
    .select()
    .from(chapters)
    .where(and(eq(chapters.bookId, book.id), eq(chapters.chapterNumber, chapterNum)))
    .limit(1);
  if (!row) return NextResponse.json({ error: "chapter not found" }, { status: 404 });

  const chapter = row.generatedAt ? row : await ensureChapterContent(row.id);

  const [nextRow] = await db
    .select({ id: chapters.id })
    .from(chapters)
    .where(and(eq(chapters.bookId, book.id), eq(chapters.chapterNumber, chapterNum + 1)))
    .limit(1);

  const hasPrev = chapterNum > 1;
  const hasNext = Boolean(nextRow);

  return NextResponse.json({
    book: { id: book.id, slug: book.slug, title: book.title, totalChapters: book.totalChapters },
    chapter,
    hasPrev,
    hasNext,
  });
}
