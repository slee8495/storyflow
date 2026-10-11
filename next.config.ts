import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Chapter illustrations go through Vercel's image optimizer, so the phone gets a phone-sized
    // file. Most live in public/illustrations; the Met's are still hotlinked from its CDN.
    remotePatterns: [new URL("https://images.metmuseum.org/**")],
  },
  // The offline service worker (public/sw.js) must be re-checked on every load, or a phone can
  // keep running an old copy for a day.
  async headers() {
    return [{ source: "/sw.js", headers: [{ key: "Cache-Control", value: "no-cache" }] }];
  },
};

export default nextConfig;
