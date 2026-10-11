"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import {
  downloadBook,
  MANIFEST_EVENT,
  offlineSupported,
  readManifest,
  type DownloadPlan,
  type DownloadProgress,
  type Manifest,
} from "@/lib/offline";
import { useUiLanguage } from "./UiLanguageProvider";

// One download at a time, held here (above the pages) so it keeps going while the reader moves
// between the book page, a chapter, and settings.
type Job = { slug: string; progress: DownloadProgress; status: "running" | "done" | "cancelled" | "error" };

type OfflineContextValue = {
  supported: boolean;
  online: boolean;
  manifest: Manifest;
  job: Job | null;
  startDownload: (plan: DownloadPlan) => void;
  cancelDownload: () => void;
  clearJob: () => void;
};

const OfflineContext = createContext<OfflineContextValue | null>(null);

export function OfflineProvider({ children }: { children: React.ReactNode }) {
  const [supported, setSupported] = useState(false);
  const [online, setOnline] = useState(true);
  const [manifest, setManifest] = useState<Manifest>({ books: {} });
  const [job, setJob] = useState<Job | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    // Service workers stay out of `next dev` — a cached dev bundle would mask code changes.
    const ok = offlineSupported() && process.env.NODE_ENV === "production";
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSupported(ok);
    setManifest(readManifest());
    setOnline(navigator.onLine);
    if (ok) navigator.serviceWorker.register("/sw.js").catch(() => setSupported(false));

    const flush = () => navigator.serviceWorker?.controller?.postMessage("flush-outbox");
    const onOnline = () => {
      setOnline(true);
      flush();
    };
    const onOffline = () => setOnline(false);
    const onManifest = () => setManifest(readManifest());
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    window.addEventListener(MANIFEST_EVENT, onManifest);
    if (navigator.onLine) flush();
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      window.removeEventListener(MANIFEST_EVENT, onManifest);
    };
  }, []);

  const startDownload = useCallback((plan: DownloadPlan) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const update = (progress: DownloadProgress) =>
      setJob((cur) => (abortRef.current === controller ? { slug: plan.slug, progress, status: cur?.status ?? "running" } : cur));
    setJob({
      slug: plan.slug,
      status: "running",
      progress: { textDone: 0, textTotal: 0, audioDone: 0, audioTotal: 0, audioChunkDone: 0, audioChunkTotal: 0, failed: 0 },
    });
    downloadBook(plan, update, controller.signal)
      .then(() => {
        if (abortRef.current !== controller) return;
        setJob((cur) => (cur ? { ...cur, status: controller.signal.aborted ? "cancelled" : "done" } : cur));
      })
      .catch(() => {
        if (abortRef.current !== controller) return;
        setJob((cur) => (cur ? { ...cur, status: controller.signal.aborted ? "cancelled" : "error" } : cur));
      });
  }, []);

  const cancelDownload = useCallback(() => abortRef.current?.abort(), []);
  const clearJob = useCallback(() => setJob((cur) => (cur?.status === "running" ? cur : null)), []);

  return (
    <OfflineContext.Provider value={{ supported, online, manifest, job, startDownload, cancelDownload, clearJob }}>
      {children}
    </OfflineContext.Provider>
  );
}

export function useOffline() {
  const ctx = useContext(OfflineContext);
  if (!ctx) throw new Error("useOffline must be used within OfflineProvider");
  return ctx;
}

// Small header pill so it's obvious why only saved chapters open.
export function OfflineBadge() {
  const { online } = useOffline();
  const { t } = useUiLanguage();
  if (online) return null;
  return (
    <span className="rounded-full bg-[var(--clay-tint)] px-2 py-0.5 text-xs font-medium text-[var(--clay-deep)]">
      {t("offline.badge")}
    </span>
  );
}
