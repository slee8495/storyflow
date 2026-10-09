import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Chapter illustrations are hotlinked museum images (data/*.json). Serving them through
    // Vercel's image optimizer means the phone only ever talks to our own domain — museum hosts'
    // hotlink/referrer/rate-limit rules stopped applying per-client — and gets a phone-sized file
    // instead of a 1MB+ original. Not artic.edu: its IIIF server refuses Vercel's fetches (502),
    // so those images stay direct — see illustrationImageProps in the chapter page.
    remotePatterns: [new URL("https://images.metmuseum.org/**"), new URL("https://upload.wikimedia.org/**")],
  },
};

export default nextConfig;
