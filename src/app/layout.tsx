import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import { FontScaleProvider } from "./FontScaleProvider";
import { NowPlayingBar } from "./NowPlayingBar";
import { OfflineBadge, OfflineProvider } from "./OfflineProvider";
import { PlaybackProvider } from "./PlaybackProvider";
import { ReaderProvider } from "./ReaderProvider";
import { SettingsLink } from "./SettingsLink";
import { ThemeProvider } from "./ThemeProvider";
import { UiLanguageProvider } from "./UiLanguageProvider";
import { FONT_SCALE_STORAGE_KEY } from "@/lib/fontScale";
import { THEME_STORAGE_KEY } from "@/lib/theme";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Storyflow",
  description: "Personal reading app — classic novels retold in easy, engaging prose, a little at a time.",
  appleWebApp: {
    capable: true,
    title: "Storyflow",
    statusBarStyle: "black-translucent",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7f5f0" },
    { media: "(prefers-color-scheme: dark)", color: "#1c1d21" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var s=localStorage.getItem(${JSON.stringify(
              FONT_SCALE_STORAGE_KEY,
            )});if(s)document.documentElement.style.setProperty("--font-scale",s);var t=localStorage.getItem(${JSON.stringify(
              THEME_STORAGE_KEY,
            )});if(t&&t!=="system")document.documentElement.setAttribute("data-theme",t);}catch(e){}})();`,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col bg-[var(--paper)] text-[var(--ink)]">
        <ThemeProvider>
        <FontScaleProvider>
          <UiLanguageProvider>
            <OfflineProvider>
              <PlaybackProvider>
                <ReaderProvider>
                  <header
                    className="sticky top-0 z-10 border-b border-[var(--line)] bg-[var(--paper)]/90 backdrop-blur"
                    style={{ paddingTop: "env(safe-area-inset-top)" }}
                  >
                    <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-3">
                      <Link href="/" className="text-lg font-semibold tracking-tight text-[var(--clay-deep)]">
                        📚 Storyflow
                      </Link>
                      <div className="flex items-center gap-3">
                        <OfflineBadge />
                        <SettingsLink />
                      </div>
                    </div>
                  </header>
                  <main
                    className="mx-auto w-full max-w-2xl flex-1 px-4 py-6"
                    style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
                  >
                    {children}
                  </main>
                  <NowPlayingBar />
                </ReaderProvider>
              </PlaybackProvider>
            </OfflineProvider>
          </UiLanguageProvider>
        </FontScaleProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
