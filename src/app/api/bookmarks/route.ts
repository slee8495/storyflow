import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { bookmarks } from "@/db/schema";

// Upserts a reader's "last read chapter" for a book — called whenever a chapter's reading page
// mounts. One row per (readerId, bookId); onConflict just moves the pointer forward or back to
// wherever the reader actually is now.
export async function POST(req: NextRequest) {
  const { readerId, bookId, chapterNumber } = await req.json().catch(() => ({}));
  if (!readerId || !bookId || !chapterNumber) {
    return NextResponse.json({ error: "readerId, bookId, and chapterNumber are required" }, { status: 400 });
  }

  const [existing] = await db
    .select()
    .from(bookmarks)
    .where(and(eq(bookmarks.readerId, readerId), eq(bookmarks.bookId, bookId)))
    .limit(1);

  if (existing) {
    const [updated] = await db
      .update(bookmarks)
      .set({ chapterNumber, updatedAt: new Date() })
      .where(eq(bookmarks.id, existing.id))
      .returning();
    return NextResponse.json({ bookmark: updated });
  }

  const [created] = await db.insert(bookmarks).values({ readerId, bookId, chapterNumber }).returning();
  return NextResponse.json({ bookmark: created });
}
