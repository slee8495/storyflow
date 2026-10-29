import { NextRequest, NextResponse } from "next/server";
import { eq, and, count, isNotNull } from "drizzle-orm";
import { db } from "@/db";
import { archivedBooks, books, bookmarks, chapters, finishedBooks } from "@/db/schema";
import { computeListenSecondsLeft, computeOverallProgressPct, loadChapterLengths } from "@/lib/progress";

// Library list — every book, with the requesting reader's current bookmark chapter (if any) so
// the UI can offer "이어읽기" (resume) straight from the grid. `readyChapters` counts chapters
// whose retelling exists, so a book still being translated can show how far along it is.
// `lastReadAt` (the bookmark's last touch) keeps the book being read on top; `finishedOn` sorts a
// book into the Finished tab and feeds the reading-stats dashboard; `archivedAt` puts a book the
// reader set aside into the Archived tab. `progressPct` is the whole-book share read, counting the
// sentence position inside the bookmarked chapter (same measure as the chapter page's toolbar).
// `listenSecondsLeft` estimates the narration left from that position (the whole book when not
// started yet), null for finished books.
export async function GET(req: NextRequest) {
  const readerId = Number(req.nextUrl.searchParams.get("readerId") ?? "");
  const allBooks = await db.select().from(books);
  const readyRows = await db
    .select({ bookId: chapters.bookId, ready: count() })
    .from(chapters)
    .where(isNotNull(chapters.generatedAt))
    .groupBy(chapters.bookId);
  const readyByBook = new Map(readyRows.map((r) => [r.bookId, r.ready]));
  const lengthsByBook = await loadChapterLengths();

  const withProgress = await Promise.all(
    allBooks.map(async (book) => {
      const readyChapters = readyByBook.get(book.id) ?? 0;
      if (!readerId) {
        return {
          ...book,
          readyChapters,
          bookmarkChapter: null as number | null,
          progressPct: null as number | null,
          listenSecondsLeft: null as number | null,
          lastReadAt: null,
          finishedOn: null,
          archivedAt: null,
        };
      }
      const [mark] = await db
        .select()
        .from(bookmarks)
        .where(and(eq(bookmarks.readerId, readerId), eq(bookmarks.bookId, book.id)))
        .limit(1);
      const [finished] = await db
        .select()
        .from(finishedBooks)
        .where(and(eq(finishedBooks.readerId, readerId), eq(finishedBooks.bookId, book.id)))
        .limit(1);
      const [archived] = await db
        .select()
        .from(archivedBooks)
        .where(and(eq(archivedBooks.readerId, readerId), eq(archivedBooks.bookId, book.id)))
        .limit(1);
      return {
        ...book,
        readyChapters,
        bookmarkChapter: mark?.chapterNumber ?? null,
        progressPct: mark
          ? Math.floor(
              await computeOverallProgressPct(
                book,
                mark.chapterNumber,
                mark.chunkIndex,
                mark.lang as "ko" | "en" | null,
              ),
            )
          : null,
        listenSecondsLeft: finished
          ? null
          : await computeListenSecondsLeft(
              book,
              lengthsByBook.get(book.id) ?? [],
              mark?.chapterNumber ?? 1,
              mark?.chunkIndex ?? null,
              (mark?.lang as "ko" | "en" | null) ?? null,
            ),
        lastReadAt: mark?.updatedAt ?? null,
        finishedOn: finished?.finishedOn ?? null,
        archivedAt: archived?.archivedAt ?? null,
      };
    }),
  );

  return NextResponse.json({ books: withProgress });
}
