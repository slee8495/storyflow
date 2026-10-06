// Storyflow's mark: an open book with a gold bookmark ribbon flowing out of its spine in an S —
// the story "flowing" off the page, and the ribbon doubling as the app's hand-placed bookmarks.
// Indigo ground matches globals.css's --clay palette. One SVG is the single source for every
// icon: the web icons below (rendered by next/og) and the iOS AppIcon PNG (ios/README).
export const ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><radialGradient id="bg" cx="50%" cy="28%" r="85%"><stop offset="0" stop-color="#4357b3"/><stop offset="0.5" stop-color="#25336f"/><stop offset="1" stop-color="#151c44"/></radialGradient><linearGradient id="gold" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f6d98f"/><stop offset="1" stop-color="#c58a2c"/></linearGradient><linearGradient id="pageL" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fdf9ef"/><stop offset="1" stop-color="#e4d7bb"/></linearGradient><linearGradient id="pageR" x1="1" y1="0" x2="0" y2="0"><stop offset="0" stop-color="#fdf9ef"/><stop offset="1" stop-color="#e4d7bb"/></linearGradient></defs><rect width="100" height="100" fill="url(#bg)"/><path d="M50 50 C 50 59, 62 59.5, 62 67 C 62 74, 53 75, 53 81" fill="none" stroke="url(#gold)" stroke-width="6.5"/><path d="M49.75 81.2 L53 77.6 L56.25 81.2 Z" fill="#171f4a"/><path d="M50 54 C 41 48.5, 29 48, 16 51 L 16 49 C 29 46, 41 46.5, 50 52 C 59 46.5, 71 46, 84 49 L 84 51 C 71 48, 59 48.5, 50 54 Z" fill="#cdbd98"/><path d="M50 52 C 41 46.5, 29 46, 16 49 L 16 24 C 29 21, 41 21.5, 50 27 Z" fill="url(#pageL)"/><path d="M50 52 C 59 46.5, 71 46, 84 49 L 84 24 C 71 21, 59 21.5, 50 27 Z" fill="url(#pageR)"/><path d="M50 27 L50 52" stroke="#bfae86" stroke-width="0.7"/><g stroke="#cfc2a3" stroke-width="1.2" stroke-linecap="round" fill="none"><path d="M23 31 C 31 29.4, 38 29.7, 44 31.8"/><path d="M23 36 C 31 34.4, 38 34.7, 44 36.8"/><path d="M23 41 C 31 39.4, 36 39.6, 40 41"/><path d="M56 31.8 C 62 29.7, 69 29.4, 77 31"/><path d="M56 36.8 C 62 34.7, 69 34.4, 77 36"/><path d="M56 41.8 C 62 39.7, 69 39.4, 77 41"/></g><path d="M74 12 L75.3 15.7 L79 17 L75.3 18.3 L74 22 L72.7 18.3 L69 17 L72.7 15.7 Z" fill="#f6d98f" opacity="0.95"/></svg>`;

const ICON_DATA_URI = `data:image/svg+xml;base64,${Buffer.from(ICON_SVG).toString("base64")}`;

export function AppIconMark({ size }: { size: number }) {
  // next/og (satori) rasterizes an <img> SVG faithfully, gradients included, where inline <svg>
  // children would need satori's narrower SVG subset.
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={ICON_DATA_URI} width={size} height={size} alt="" />;
}
