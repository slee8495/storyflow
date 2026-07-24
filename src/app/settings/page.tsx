"use client";

import { FONT_SCALES } from "@/lib/fontScale";
import { useFontScale } from "../FontScaleProvider";
import { ReaderGate, useReader } from "../ReaderProvider";
import { useUiLanguage } from "../UiLanguageProvider";

export default function SettingsPage() {
  const { scale, setScale } = useFontScale();
  const { reader, loading, signOut } = useReader();
  const { uiLang, setUiLang, t } = useUiLanguage();

  if (loading) return null;
  if (!reader) return <ReaderGate />;

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold text-[var(--ink)]">{t("settings.title")}</h1>

      <section className="flex flex-col gap-3 rounded-2xl border border-[var(--line)] bg-[var(--paper-raised)] p-4">
        <h2 className="text-sm font-semibold text-[var(--ink-soft)]">{t("settings.account")}</h2>
        <div className="flex items-center justify-between">
          <p className="text-sm text-[var(--ink)]">{reader.name}</p>
          <button
            type="button"
            onClick={signOut}
            className="rounded-lg border border-[var(--line)] px-3 py-1.5 text-xs font-medium text-[var(--ink-soft)] hover:border-[var(--clay)] hover:text-[var(--ink)]"
          >
            {t("settings.signOut")}
          </button>
        </div>
        <p className="text-sm text-[var(--ink-soft)]">{t("settings.accountHint")}</p>
      </section>

      <section className="flex flex-col gap-3 rounded-2xl border border-[var(--line)] bg-[var(--paper-raised)] p-4">
        <h2 className="text-sm font-semibold text-[var(--ink-soft)]">{t("settings.uiLanguage")}</h2>
        <div className="flex w-fit gap-1 rounded-full bg-[var(--clay-tint)] p-0.5 text-xs">
          <button
            type="button"
            onClick={() => setUiLang("en")}
            className={`rounded-full px-3 py-1.5 font-medium ${
              uiLang === "en" ? "bg-[var(--paper-raised)] text-[var(--ink)] shadow-sm" : "text-[var(--ink-soft)]"
            }`}
          >
            English
          </button>
          <button
            type="button"
            onClick={() => setUiLang("ko")}
            className={`rounded-full px-3 py-1.5 font-medium ${
              uiLang === "ko" ? "bg-[var(--paper-raised)] text-[var(--ink)] shadow-sm" : "text-[var(--ink-soft)]"
            }`}
          >
            한국어
          </button>
        </div>
        <p className="text-sm text-[var(--ink-soft)]">{t("settings.uiLanguageHint")}</p>
      </section>

      <section className="flex flex-col gap-3 rounded-2xl border border-[var(--line)] bg-[var(--paper-raised)] p-4">
        <h2 className="text-sm font-semibold text-[var(--ink-soft)]">{t("settings.fontSize")}</h2>
        <div className="grid grid-cols-3 gap-2">
          {FONT_SCALES.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setScale(option.value)}
              aria-pressed={scale === option.value}
              className={`flex flex-col items-center gap-1 rounded-xl border px-2 py-3 transition-colors ${
                scale === option.value
                  ? "border-[var(--clay-deep)] bg-[var(--clay-tint)] text-[var(--clay-deep)]"
                  : "border-[var(--line)] text-[var(--ink-soft)] hover:text-[var(--ink)]"
              }`}
            >
              <span style={{ fontSize: `${option.value}rem` }}>Aa</span>
              <span className="text-xs">{option.label}</span>
            </button>
          ))}
        </div>
        <p className="text-sm text-[var(--ink-soft)]">{t("settings.fontSizeHint")}</p>
      </section>
    </div>
  );
}
