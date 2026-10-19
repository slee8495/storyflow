import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { archivedBooks, books } from "@/db/schema";

// Whether the reader has set this book aside for later (see schema.ts archivedBooks).
//   GET    ?readerId=        → { archivedAt: ISO string | null }
//   POST   { readerId }      → archive (idempotent)
//   DELETE ?readerId=        → back to the Reading tab
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
    .from(archivedBooks)
    .where(and(eq(archivedBooks.readerId, readerId), eq(archivedBooks.bookId, book.id)))
    .limit(1);
  return NextResponse.json({ archivedAt: row?.archivedAt ?? null });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { readerId } = await req.json().catch(() => ({}));
  if (!readerId) return NextResponse.json({ error: "readerId is required" }, { status: 400 });
  const book = await findBook(slug);
  if (!book) return NextResponse.json({ error: "book not found" }, { status: 404 });

  const [row] = await db
    .insert(archivedBooks)
    .values({ readerId, bookId: book.id })
    .onConflictDoUpdate({
      target: [archivedBooks.readerId, archivedBooks.bookId],
      set: { archivedAt: new Date() },
    })
    .returning();
  return NextResponse.json({ archivedAt: row.archivedAt });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const readerId = Number(req.nextUrl.searchParams.get("readerId") ?? "");
  if (!readerId) return NextResponse.json({ error: "readerId is required" }, { status: 400 });
  const book = await findBook(slug);
  if (!book) return NextResponse.json({ error: "book not found" }, { status: 404 });

  await db.delete(archivedBooks).where(and(eq(archivedBooks.readerId, readerId), eq(archivedBooks.bookId, book.id)));
  return NextResponse.json({ archivedAt: null });
}
