import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { SUPPORTED_LANGUAGES, SPELL_CHECK_LANGS } from "../i18n/index";
import { useSettingsStore } from "../stores/settings";

export function LanguagePicker() {
  const { i18n } = useTranslation();
  const { lang, spellLang, setLang, setSpellLang } = useSettingsStore();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const current = SUPPORTED_LANGUAGES.find((l) => l.code === lang) ?? SUPPORTED_LANGUAGES[0];

  function pick(code: string) {
    setLang(code);
    i18n.changeLanguage(code);
    const spellCode = SPELL_CHECK_LANGS[code];
    if (spellLang !== undefined) setSpellLang(spellCode);
    setOpen(false);
  }

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        className="btn btn-ghost btn-sm"
        onClick={() => setOpen((v) => !v)}
        style={{ gap: 4, fontFamily: "var(--font-mono)", fontSize: "var(--fs-xs)" }}
        title="Language / Idioma"
      >
        <span>{current.flag}</span>
        <span>{current.code.toUpperCase()}</span>
      </button>

      {open && (
        <div
          style={{
            position: "absolute", top: "calc(100% + 4px)", right: 0, zIndex: 200,
            background: "var(--bg-panel)", border: "1px solid var(--border-soft)",
            borderRadius: "var(--r-lg)", padding: 6, minWidth: 180,
            boxShadow: "0 4px 16px rgba(0,0,0,.15)",
          }}
          onMouseLeave={() => setOpen(false)}
        >
          {SUPPORTED_LANGUAGES.map((l) => (
            <div
              key={l.code}
              onClick={() => pick(l.code)}
              style={{
                display: "flex", alignItems: "center", gap: 8,
                padding: "6px 10px", borderRadius: "var(--r-md)", cursor: "pointer",
                background: l.code === lang ? "var(--bg-selected)" : "transparent",
                color: l.code === lang ? "var(--accent-deep)" : "var(--fg-default)",
                fontSize: "var(--fs-base)", fontWeight: l.code === lang ? 500 : 400,
              }}
            >
              <span style={{ fontSize: 16 }}>{l.flag}</span>
              <span style={{ flex: 1 }}>{l.label}</span>
              {l.code === lang && <span style={{ fontSize: 11, color: "var(--accent)" }}>✓</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
