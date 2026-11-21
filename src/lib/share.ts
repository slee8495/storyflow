// "Share" deployment: the same app deployed as a second Vercel project for someone else (the
// reader's wife), showing only the books named in NEXT_PUBLIC_SHARE_BOOKS (comma-separated slugs).
// Unset (the main deployment) means every book, nothing changes. NEXT_PUBLIC_ so the client home
// page can hide the reading-plan link too; it's inlined at build time, which is fine because each
// Vercel project builds with its own env.
const raw = process.env.NEXT_PUBLIC_SHARE_BOOKS ?? "";

export const SHARE_BOOKS: string[] = raw
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

export const IS_SHARE = SHARE_BOOKS.length > 0;

export function isBookShared(slug: string): boolean {
  return !IS_SHARE || SHARE_BOOKS.includes(slug);
}
