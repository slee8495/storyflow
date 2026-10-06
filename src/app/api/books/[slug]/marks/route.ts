import { NextRequest, NextResponse } from "next/server";
import { and, asc, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { books, savedMarks } from "@/db/schema";

// The reader's hand-placed bookmarks for one book (see schema.ts savedMarks). Same identity model
// as the rest of the app — readerId is trusted as-is (personal, name-based login, no auth).
//   GET    ?readerId=            → every mark in the book, in reading order
//   POST   { readerId, chapterNumber, chunkIndex?, lang?, excerpt } → create (idempotent: an
//          existing mark on the same sentence/chapter is returned instead of duplicated)
//   PATCH  { readerId, id, note } → set/clear the memo
//   DELETE ?readerId=&id=        → remove
async function findBook(slug: string) {
  const [book] = await db.select().from(books).where(eq(books.slug, slug)).limit(1);
  return book;
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const readerId = Number(req.nextUrl.searchParams.get("readerId") ?? "");
  if (!readerId) return NextResponse.json({ error: "readerId is required" }, { status: 400 });
  const book = await findBook(slug);
  if (!book) return NextResponse.json({ error: "book not found" }, { status: 404 });

  const marks = await db
    .select()
    .from(savedMarks)
    .where(and(eq(savedMarks.readerId, readerId), eq(savedMarks.bookId, book.id)))
    .orderBy(asc(savedMarks.chapterNumber), asc(savedMarks.chunkIndex), asc(savedMarks.createdAt));
  return NextResponse.json({ marks });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { readerId, chapterNumber, chunkIndex, lang, excerpt } = await req.json().catch(() => ({}));
  if (!readerId || !chapterNumber || typeof excerpt !== "string" || !excerpt.trim()) {
    return NextResponse.json({ error: "readerId, chapterNumber, and excerpt are required" }, { status: 400 });
  }
  const isSentence = typeof chunkIndex === "number" && (lang === "ko" || lang === "en");
  const book = await findBook(slug);
  if (!book) return NextResponse.json({ error: "book not found" }, { status: 404 });

  const [existing] = await db
    .select()
    .from(savedMarks)
    .where(
      and(
        eq(savedMarks.readerId, readerId),
        eq(savedMarks.bookId, book.id),
        eq(savedMarks.chapterNumber, chapterNumber),
        isSentence ? eq(savedMarks.chunkIndex, chunkIndex) : isNull(savedMarks.chunkIndex),
        isSentence ? eq(savedMarks.lang, lang) : isNull(savedMarks.lang),
      ),
    )
    .limit(1);
  if (existing) return NextResponse.json({ mark: existing });

  const [mark] = await db
    .insert(savedMarks)
    .values({
      readerId,
      bookId: book.id,
      chapterNumber,
      chunkIndex: isSentence ? chunkIndex : null,
      lang: isSentence ? lang : null,
      excerpt: excerpt.trim(),
    })
    .returning();
  return NextResponse.json({ mark });
}

export async function PATCH(req: NextRequest) {
  const { readerId, id, note } = await req.json().catch(() => ({}));
  if (!readerId || !id) return NextResponse.json({ error: "readerId and id are required" }, { status: 400 });
  const trimmed = typeof note === "string" ? note.trim() : "";
  const [mark] = await db
    .update(savedMarks)
    .set({ note: trimmed || null })
    .where(and(eq(savedMarks.id, id), eq(savedMarks.readerId, readerId)))
    .returning();
  if (!mark) return NextResponse.json({ error: "mark not found" }, { status: 404 });
  return NextResponse.json({ mark });
}

export async function DELETE(req: NextRequest) {
  const readerId = Number(req.nextUrl.searchParams.get("readerId") ?? "");
  const id = Number(req.nextUrl.searchParams.get("id") ?? "");
  if (!readerId || !id) return NextResponse.json({ error: "readerId and id are required" }, { status: 400 });
  await db.delete(savedMarks).where(and(eq(savedMarks.id, id), eq(savedMarks.readerId, readerId)));
  return NextResponse.json({ ok: true });
}
