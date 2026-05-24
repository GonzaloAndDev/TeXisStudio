import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { SUPPORTED_LANGUAGES, SPELL_CHECK_LANGS } from "../i18n/index";
import { useSettingsStore } from "../stores/settings";
import { useLangPacksStore } from "../stores/languagePacks";

// ─────────────────────────────────────────────────────────────────────────────
// Unified language entry for the picker (bundled + community installed)
// ─────────────────────────────────────────────────────────────────────────────
interface PickerEntry {
  code: string;
  label: string;
  flag: string;
  bundled: boolean;
}

export function LanguagePicker() {
  const { i18n } = useTranslation();
  const { lang, spellLang, setLang, setSpellLang } = useSettingsStore();
  const { installed } = useLangPacksStore();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Build the combined list: bundled first, then installed community packs
  // (exclude community packs that duplicate a bundled ID, just in case)
  const bundledCodes = new Set(SUPPORTED_LANGUAGES.map((l) => l.code));
  const communityEntries: PickerEntry[] = installed
    .filter((p) => !bundledCodes.has(p.id) && p.entry.capabilities.ui)
    .map((p) => ({
      code: p.id,
      label: p.entry.native_name,
      flag: p.entry.flag,
      bundled: false,
    }));

  const allEntries: PickerEntry[] = [
    ...SUPPORTED_LANGUAGES.map((l) => ({ ...l, bundled: true })),
    ...communityEntries,
  ];

  const current = allEntries.find((l) => l.code === lang) ?? allEntries[0];

  function pick(code: string) {
    setLang(code);
    i18n.changeLanguage(code);
    const spellCode = SPELL_CHECK_LANGS[code];
    if (spellLang !== undefined) setSpellLang(spellCode ?? null);
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
          {/* Bundled languages */}
          {SUPPORTED_LANGUAGES.map((l) => (
            <PickerRow
              key={l.code}
              code={l.code}
              flag={l.flag}
              label={l.label}
              active={l.code === lang}
              onPick={pick}
            />
          ))}

          {/* Community divider + entries */}
          {communityEntries.length > 0 && (
            <>
              <div
                style={{
                  margin: "4px 4px",
                  borderTop: "1px solid var(--border-soft)",
                  paddingTop: 4,
                }}
              />
              {communityEntries.map((l) => (
                <PickerRow
                  key={l.code}
                  code={l.code}
                  flag={l.flag}
                  label={l.label}
                  active={l.code === lang}
                  onPick={pick}
                  community
                />
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Single row inside the dropdown
// ─────────────────────────────────────────────────────────────────────────────
interface PickerRowProps {
  code: string;
  flag: string;
  label: string;
  active: boolean;
  onPick: (code: string) => void;
  community?: boolean;
}

function PickerRow({ code, flag, label, active, onPick, community }: PickerRowProps) {
  return (
    <div
      onClick={() => onPick(code)}
      style={{
        display: "flex", alignItems: "center", gap: 8,
        padding: "6px 10px", borderRadius: "var(--r-md)", cursor: "pointer",
        background: active ? "var(--bg-selected)" : "transparent",
        color: active ? "var(--accent-deep)" : "var(--fg-default)",
        fontSize: "var(--fs-base)", fontWeight: active ? 500 : 400,
      }}
    >
      <span style={{ fontSize: 16 }}>{flag}</span>
      <span style={{ flex: 1 }}>{label}</span>
      {community && (
        <span style={{
          fontSize: 9, color: "var(--fg-faint)", background: "var(--bg-chrome)",
          borderRadius: 3, padding: "1px 4px", textTransform: "uppercase",
          letterSpacing: "0.05em",
        }}>
          DL
        </span>
      )}
      {active && <span style={{ fontSize: 11, color: "var(--accent)" }}>✓</span>}
    </div>
  );
}
