import { NextRequest, NextResponse } from "next/server";
import { eq, and, count, isNotNull } from "drizzle-orm";
import { db } from "@/db";
import { books, bookmarks, chapters } from "@/db/schema";

// Library list — every book, with the requesting reader's current bookmark chapter (if any) so
// the UI can offer "이어읽기" (resume) straight from the grid. `readyChapters` counts chapters
// whose retelling exists, so a book still being translated can show how far along it is.
export async function GET(req: NextRequest) {
  const readerId = Number(req.nextUrl.searchParams.get("readerId") ?? "");
  const allBooks = await db.select().from(books);
  const readyRows = await db
    .select({ bookId: chapters.bookId, ready: count() })
    .from(chapters)
    .where(isNotNull(chapters.generatedAt))
    .groupBy(chapters.bookId);
  const readyByBook = new Map(readyRows.map((r) => [r.bookId, r.ready]));

  const withProgress = await Promise.all(
    allBooks.map(async (book) => {
      const readyChapters = readyByBook.get(book.id) ?? 0;
      if (!readerId) return { ...book, readyChapters, bookmarkChapter: null as number | null };
      const [mark] = await db
        .select()
        .from(bookmarks)
        .where(and(eq(bookmarks.readerId, readerId), eq(bookmarks.bookId, book.id)))
        .limit(1);
      return { ...book, readyChapters, bookmarkChapter: mark?.chapterNumber ?? null };
    }),
  );

  return NextResponse.json({ books: withProgress });
}
