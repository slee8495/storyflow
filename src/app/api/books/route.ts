import { NextRequest, NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import { books, bookmarks } from "@/db/schema";

// Library list — every book, with the requesting reader's current bookmark chapter (if any) so
// the UI can offer "이어읽기" (resume) straight from the grid.
export async function GET(req: NextRequest) {
  const readerId = Number(req.nextUrl.searchParams.get("readerId") ?? "");
  const allBooks = await db.select().from(books);

  const withProgress = await Promise.all(
    allBooks.map(async (book) => {
      if (!readerId) return { ...book, bookmarkChapter: null as number | null };
      const [mark] = await db
        .select()
        .from(bookmarks)
        .where(and(eq(bookmarks.readerId, readerId), eq(bookmarks.bookId, book.id)))
        .limit(1);
      return { ...book, bookmarkChapter: mark?.chapterNumber ?? null };
    }),
  );

  return NextResponse.json({ books: withProgress });
}
