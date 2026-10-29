import { NextRequest, NextResponse } from "next/server";
import { asc, count, eq, isNotNull } from "drizzle-orm";
import { db } from "@/db";
import { bookmarks, books, chapters, finishedBooks, readingPlan } from "@/db/schema";
import { BOOK_QUEUE, ROWS_PER_NIGHT } from "@/lib/bookQueue";

// The reading plan behind the "Projected order" page. GET lists the plan in order — each entry
// with its translation state and, for the requesting reader, whether they're reading or have
// finished it — plus `available`: books that could be put back (plan books removed earlier, and
// library books not on the plan). `nightsUntilReady` counts the nightly batches (ROWS_PER_NIGHT
// rows each, front to back) until that book is fully translated; 0 means ready now.
// PUT { slugs } replaces the whole plan with that order — reordering, removing and re-adding
// are all just a new list.
async function entryInfo(readerId: number) {
  const library = await db.select().from(books);
  const readyRows = await db
    .select({ bookId: chapters.bookId, ready: count() })
    .from(chapters)
    .where(isNotNull(chapters.generatedAt))
    .groupBy(chapters.bookId);
  const ready = new Map(readyRows.map((r) => [r.bookId, r.ready]));
  const marks = readerId ? await db.select().from(bookmarks).where(eq(bookmarks.readerId, readerId)) : [];
  const finished = readerId ? await db.select().from(finishedBooks).where(eq(finishedBooks.readerId, readerId)) : [];

  return (slug: string) => {
    const book = library.find((b) => b.slug === slug);
    const queued = BOOK_QUEUE.find((b) => b.slug === slug);
    if (!book && !queued) return null;
    const total = book?.totalChapters ?? queued?.estimatedRows ?? 0;
    return {
      slug,
      title: book?.title ?? queued!.title,
      titleEn: book?.titleEn ?? queued!.titleEn,
      author: book?.author ?? queued!.author,
      coverColor: book?.coverColor ?? queued!.coverColor,
      inLibrary: !!book,
      totalChapters: total,
      readyChapters: book ? (ready.get(book.id) ?? 0) : 0,
      reading: !!book && marks.some((m) => m.bookId === book.id),
      finishedOn: (book && finished.find((f) => f.bookId === book.id)?.finishedOn) ?? null,
    };
  };
}

export async function GET(req: NextRequest) {
  const readerId = Number(req.nextUrl.searchParams.get("readerId") ?? "") || 0;
  const info = await entryInfo(readerId);
  const plan = await db.select().from(readingPlan).orderBy(asc(readingPlan.position));

  let rowsAhead = 0;
  const entries = plan.flatMap(({ slug }) => {
    const entry = info(slug);
    if (!entry) return [];
    rowsAhead += entry.totalChapters - entry.readyChapters;
    const nightsUntilReady = entry.readyChapters >= entry.totalChapters ? 0 : Math.ceil(rowsAhead / ROWS_PER_NIGHT);
    return [{ ...entry, nightsUntilReady }];
  });

  const onPlan = new Set(plan.map((p) => p.slug));
  const library = await db.select({ slug: books.slug }).from(books);
  const candidates = [...BOOK_QUEUE.map((b) => b.slug), ...library.map((b) => b.slug)];
  const available = [...new Set(candidates)]
    .filter((slug) => !onPlan.has(slug))
    .flatMap((slug) => (info(slug) ? [info(slug)!] : []));

  return NextResponse.json({ entries, available, rowsPerNight: ROWS_PER_NIGHT });
}

export async function PUT(req: NextRequest) {
  const { slugs } = (await req.json().catch(() => ({}))) as { slugs?: unknown };
  if (!Array.isArray(slugs) || !slugs.every((s) => typeof s === "string") || new Set(slugs).size !== slugs.length) {
    return NextResponse.json({ error: "slugs must be a list of distinct book slugs" }, { status: 400 });
  }
  const library = await db.select({ slug: books.slug }).from(books);
  const known = new Set([...BOOK_QUEUE.map((b) => b.slug), ...library.map((b) => b.slug)]);
  const unknown = slugs.filter((s) => !known.has(s));
  if (unknown.length) return NextResponse.json({ error: `unknown books: ${unknown.join(", ")}` }, { status: 400 });

  await db.transaction(async (tx) => {
    await tx.delete(readingPlan);
    if (slugs.length) await tx.insert(readingPlan).values(slugs.map((slug, i) => ({ slug, position: i + 1 })));
  });
  return NextResponse.json({ ok: true });
}
