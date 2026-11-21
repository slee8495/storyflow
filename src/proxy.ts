import { NextResponse, type NextRequest } from "next/server";
import { PIN_COOKIE, pinToken } from "@/lib/pinCookie";
import { IS_SHARE, isBookShared } from "@/lib/share";

// Locks the web screens behind a 6-digit PIN (APP_PIN on Vercel). Once entered, an httpOnly cookie
// keeps the device in for a year. Without APP_PIN (local dev) nothing is locked.
//
// Only page navigations are locked. /api/** (watch app, native audio, offline downloads),
// /_next/**, the service worker, icons, manifest and every static file stay open, so nothing that
// works today without a browser cookie breaks.
//
// On the share deployment (src/lib/share.ts) it also hides every book that isn't shared — pages
// and their APIs alike — and the reading plan, which is the main reader's (one global list that
// steers the nightly translation).
export async function proxy(req: NextRequest) {
  const path = req.nextUrl.pathname;

  if (IS_SHARE) {
    const slug = path.match(/^\/(?:api\/books|book)\/([^/]+)/)?.[1];
    const hidden = (slug && !isBookShared(decodeURIComponent(slug))) || /^\/(?:api\/)?plan(?:\/|$)/.test(path);
    if (hidden) {
      if (path.startsWith("/api/")) return NextResponse.json({ error: "not found" }, { status: 404 });
      return NextResponse.redirect(new URL("/", req.url));
    }
  }
  if (path.startsWith("/api/")) return NextResponse.next();

  const pin = process.env.APP_PIN;
  if (!pin) return NextResponse.next();
  if (req.cookies.get(PIN_COOKIE)?.value === (await pinToken(pin))) return NextResponse.next();
  const url = req.nextUrl.clone();
  const next = path + req.nextUrl.search;
  url.pathname = "/login";
  url.search = next && next !== "/" ? `?next=${encodeURIComponent(next)}` : "";
  return NextResponse.redirect(url);
}

export const config = {
  // Pages: skip api/, _next/, the login page, generated icons/manifest, and any path with a file
  // extension (sw.js, illustrations/*.jpg, favicon.ico, ...). The two api entries only matter on
  // the share deployment; the PIN never applies to them.
  matcher: [
    "/((?!api/|_next/|login|icon|apple-icon|icons/|manifest|.*\\.[^/]+$).*)",
    "/api/books/:path+",
    "/api/plan",
  ],
};
