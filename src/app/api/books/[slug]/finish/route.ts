import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { archivedBooks, books, finishedBooks } from "@/db/schema";

// Whether the reader has finished this book, and on which day (see schema.ts finishedBooks).
//   GET    ?readerId=                 → { finishedOn: "YYYY-MM-DD" | null }
//   POST   { readerId, finishedOn }   → mark finished, or change the date (takes it out of the
//                                       Archived tab too, if it was set aside)
//   DELETE ?readerId=                 → back to "reading"
const DAY = /^\d{4}-\d{2}-\d{2}$/;

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

  const [row] = await db
    .select()
    .from(finishedBooks)
    .where(and(eq(finishedBooks.readerId, readerId), eq(finishedBooks.bookId, book.id)))
    .limit(1);
  return NextResponse.json({ finishedOn: row?.finishedOn ?? null });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { readerId, finishedOn } = await req.json().catch(() => ({}));
  if (!readerId || typeof finishedOn !== "string" || !DAY.test(finishedOn)) {
    return NextResponse.json({ error: "readerId and finishedOn (YYYY-MM-DD) are required" }, { status: 400 });
  }
  const book = await findBook(slug);
  if (!book) return NextResponse.json({ error: "book not found" }, { status: 404 });

  await db
    .insert(finishedBooks)
    .values({ readerId, bookId: book.id, finishedOn })
    .onConflictDoUpdate({
      target: [finishedBooks.readerId, finishedBooks.bookId],
      set: { finishedOn },
    });
  await db.delete(archivedBooks).where(and(eq(archivedBooks.readerId, readerId), eq(archivedBooks.bookId, book.id)));
  return NextResponse.json({ finishedOn });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const readerId = Number(req.nextUrl.searchParams.get("readerId") ?? "");
  if (!readerId) return NextResponse.json({ error: "readerId is required" }, { status: 400 });
  const book = await findBook(slug);
  if (!book) return NextResponse.json({ error: "book not found" }, { status: 404 });

  await db.delete(finishedBooks).where(and(eq(finishedBooks.readerId, readerId), eq(finishedBooks.bookId, book.id)));
  return NextResponse.json({ finishedOn: null });
}
