import { NextResponse, type NextRequest } from "next/server";
import { PIN_COOKIE, pinToken } from "@/lib/pinCookie";

// Locks the web screens behind a 6-digit PIN (APP_PIN on Vercel). Once entered, an httpOnly cookie
// keeps the device in for a year. Without APP_PIN (local dev) nothing is locked.
//
// Only page navigations are locked. /api/** (watch app, native audio, offline downloads),
// /_next/**, the service worker, icons, manifest and every static file stay open, so nothing that
// works today without a browser cookie breaks.
export async function proxy(req: NextRequest) {
  const pin = process.env.APP_PIN;
  if (!pin) return NextResponse.next();
  if (req.cookies.get(PIN_COOKIE)?.value === (await pinToken(pin))) return NextResponse.next();
  const url = req.nextUrl.clone();
  const next = req.nextUrl.pathname + req.nextUrl.search;
  url.pathname = "/login";
  url.search = next && next !== "/" ? `?next=${encodeURIComponent(next)}` : "";
  return NextResponse.redirect(url);
}

export const config = {
  // Skip api/, _next/, the login page, generated icons/manifest, and any path with a file extension
  // (sw.js, illustrations/*.jpg, favicon.ico, ...).
  matcher: ["/((?!api/|_next/|login|icon|apple-icon|icons/|manifest|.*\\.[^/]+$).*)"],
};
