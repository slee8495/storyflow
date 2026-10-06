import { NextRequest, NextResponse } from "next/server";
import { eq, and, asc } from "drizzle-orm";
import { db } from "@/db";
import { books, chapters, bookmarks, chapterIllustrations } from "@/db/schema";
import { ensureChapterContent } from "@/lib/generateChapter";

// A never-before-read chapter is generated inline on this request (two parallel Claude calls, see
// generateChapter.ts) — a ~3k-word Lady Chatterley part measured ~200s on Sonnet, so this needs
// the full 300s function budget rather than a shorter default.
export const maxDuration = 300;

// Returns one chapter's bilingual retelling, generating it on first read (see
// ensureChapterContent) and reusing the cached version on every later read. Also returns
// prev/next chapter numbers so the reading page can render its own navigation without a second
// request, and — when `readerId` is passed — the reader's saved in-chapter sentence position
// (`resume`), but only when their bookmark's chapterNumber matches THIS chapter; a bookmark
// pointing at a different chapter has no meaningful resume position here. Also returns the
// chapter's curated artwork (`illustrations`, see schema.ts chapterIllustrations), if any.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string; chapterNumber: string }> },
) {
  const { slug, chapterNumber } = await params;
  const chapterNum = Number(chapterNumber);
  if (!Number.isInteger(chapterNum) || chapterNum < 1) {
    return NextResponse.json({ error: "invalid chapter number" }, { status: 400 });
  }
  const readerId = Number(req.nextUrl.searchParams.get("readerId") ?? "");

  const [book] = await db.select().from(books).where(eq(books.slug, slug)).limit(1);
  if (!book) return NextResponse.json({ error: "book not found" }, { status: 404 });

  const [row] = await db
    .select()
    .from(chapters)
    .where(and(eq(chapters.bookId, book.id), eq(chapters.chapterNumber, chapterNum)))
    .limit(1);
  if (!row) return NextResponse.json({ error: "chapter not found" }, { status: 404 });

  const chapter = row.generatedAt ? row : await ensureChapterContent(row.id);

  const illustrations = await db
    .select()
    .from(chapterIllustrations)
    .where(eq(chapterIllustrations.chapterId, row.id))
    .orderBy(asc(chapterIllustrations.position));

  const [nextRow] = await db
    .select({ id: chapters.id })
    .from(chapters)
    .where(and(eq(chapters.bookId, book.id), eq(chapters.chapterNumber, chapterNum + 1)))
    .limit(1);

  const hasPrev = chapterNum > 1;
  const hasNext = Boolean(nextRow);

  let resume: { chunkIndex: number; lang: "ko" | "en" } | null = null;
  if (readerId) {
    const [mark] = await db
      .select()
      .from(bookmarks)
      .where(and(eq(bookmarks.readerId, readerId), eq(bookmarks.bookId, book.id)))
      .limit(1);
    if (mark && mark.chapterNumber === chapterNum && mark.chunkIndex !== null && mark.lang) {
      resume = { chunkIndex: mark.chunkIndex, lang: mark.lang as "ko" | "en" };
    }
  }

  return NextResponse.json({
    book: { id: book.id, slug: book.slug, title: book.title, totalChapters: book.totalChapters },
    chapter,
    illustrations,
    hasPrev,
    hasNext,
    resume,
  });
}
