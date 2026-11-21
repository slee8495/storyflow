// Storyflow's mark: an indigo book standing on paper, with gold sound waves spreading from it —
// a book you read and listen to. Flat shapes so it stays legible down to favicon size; the indigo
// matches globals.css's --clay palette and the ground its --paper. One SVG is the single source for
// every icon: the web icons below (rendered by next/og) and the iOS AppIcon PNG (ios/README).
// The share deployment (src/lib/share.ts) paints the book rose instead of indigo, so its home-screen
// icon is told apart from the main app's at a glance.
import { IS_SHARE } from "./share";

const BOOK = IS_SHARE
  ? { cover: "#a8325a", spine: "#6b1835", lines: "#e7a2b8" }
  : { cover: "#2b3b80", spine: "#1a2356", lines: "#7d8cc8" };
export const ICON_THEME_COLOR = BOOK.cover;

export const ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="#fbf7ee"/><rect x="20" y="22" width="34" height="56" rx="4" fill="${BOOK.cover}"/><rect x="20" y="22" width="8" height="56" rx="3" fill="${BOOK.spine}"/><path d="M34 34 H47 M34 41 H47" stroke="${BOOK.lines}" stroke-width="2.6" stroke-linecap="round"/><g fill="none" stroke="#c58a2c" stroke-width="5" stroke-linecap="round"><path d="M64.2 42.3 A12 12 0 0 1 64.2 57.7"/><path d="M70.3 37.1 A20 20 0 0 1 70.3 62.9"/><path d="M76.4 32 A28 28 0 0 1 76.4 68"/></g></svg>`;

const ICON_DATA_URI = `data:image/svg+xml;base64,${Buffer.from(ICON_SVG).toString("base64")}`;

export function AppIconMark({ size }: { size: number }) {
  // next/og (satori) rasterizes an <img> SVG faithfully, gradients included, where inline <svg>
  // children would need satori's narrower SVG subset.
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={ICON_DATA_URI} width={size} height={size} alt="" />;
}
