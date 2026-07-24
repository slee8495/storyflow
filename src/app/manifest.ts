import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Storyflow",
    short_name: "Storyflow",
    description: "읽고 싶었던 소설을 쉽고 재미있는 이야기체로, 매일 조금씩 듣고 읽는 개인 리딩 앱.",
    start_url: "/",
    display: "standalone",
    background_color: "#f7f5f0",
    theme_color: "#2b3b80",
    icons: [
      { src: "/icons/192", sizes: "192x192", type: "image/png" },
      { src: "/icons/512", sizes: "512x512", type: "image/png" },
    ],
  };
}
