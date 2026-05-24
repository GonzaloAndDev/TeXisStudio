import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { checkText, SpellError } from "../services/spellcheck";
import { useSettingsStore } from "../stores/settings";
import { SUPPORTED_LANGUAGES, SPELL_CHECK_LANGS } from "../i18n/index";

interface Props {
  text: string;
  onReplace: (original: string, replacement: string) => void;
  onClose: () => void;
}

export function SpellPanel({ text, onReplace, onClose }: Props) {
  const { t } = useTranslation();
  const { spellLang, autocorrectEnabled, setAutocorrect, setSpellLang, customDictionary, addToCustomDictionary } =
    useSettingsStore();
  const [errors, setErrors] = useState<SpellError[] | null>(null);
  const [loadErr, setLoadErr] = useState(false);
  const [ignored, setIgnored] = useState<Set<string>>(new Set());
  const busy = useRef(false);

  useEffect(() => {
    if (!spellLang) return;
    if (busy.current) return;
    busy.current = true;
    setErrors(null);
    setLoadErr(false);

    checkText(text, spellLang, customDictionary)
      .then((errs) => setErrors(errs))
      .catch(() => setLoadErr(true))
      .finally(() => { busy.current = false; });
  }, [text, spellLang, customDictionary]);

  const visible = errors?.filter((e) => !ignored.has(e.word.toLowerCase())) ?? [];

  return (
    <aside style={{
      width: 280, flexShrink: 0, borderLeft: "1px solid var(--border-subtle)",
      background: "var(--bg-panel)", display: "flex", flexDirection: "column",
      fontSize: "var(--fs-sm)",
    }}>
      {/* Header */}
      <div style={{
        padding: "10px 14px", borderBottom: "1px solid var(--border-subtle)",
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <span style={{ fontWeight: 600, color: "var(--fg-strong)" }}>
          {t("spell.panel_title")}
        </span>
        <button className="btn btn-ghost btn-icon btn-sm" onClick={onClose}>✕</button>
      </div>

      {/* Language selector */}
      <div style={{ padding: "8px 14px", borderBottom: "1px solid var(--border-subtle)", display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
        <span style={{ color: "var(--fg-muted)", fontSize: "var(--fs-xs)" }}>{t("spell.spell_lang")}:</span>
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
          {SUPPORTED_LANGUAGES.filter((l) => SPELL_CHECK_LANGS[l.code] !== null).map((l) => (
            <button
              key={l.code}
              className={`btn btn-sm ${spellLang === l.code ? "btn-accent" : "btn-ghost"}`}
              style={{ fontSize: "var(--fs-xs)", padding: "2px 6px" }}
              onClick={() => setSpellLang(l.code)}
            >
              {l.flag} {l.code.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Autocorrect toggle */}
      <label style={{
        padding: "8px 14px", borderBottom: "1px solid var(--border-subtle)",
        display: "flex", alignItems: "center", gap: 8, cursor: "pointer",
      }}>
        <input
          type="checkbox"
          checked={autocorrectEnabled}
          onChange={(e) => setAutocorrect(e.target.checked)}
        />
        <div>
          <div style={{ fontWeight: 500, color: "var(--fg-default)" }}>{t("spell.autocorrect_label")}</div>
          <div style={{ fontSize: "var(--fs-xs)", color: "var(--fg-muted)" }}>{t("spell.autocorrect_hint")}</div>
        </div>
      </label>

      {/* Results */}
      <div className="scroll" style={{ flex: 1, overflow: "auto", padding: "8px 14px" }}>
        {!spellLang && (
          <p style={{ color: "var(--fg-muted)", textAlign: "center", marginTop: 24 }}>
            {t("lang.spell_not_available")}
          </p>
        )}
        {spellLang && loadErr && (
          <p style={{ color: "var(--build-err)", textAlign: "center", marginTop: 24 }}>
            {t("spell.dict_error")}
          </p>
        )}
        {spellLang && !loadErr && errors === null && (
          <p style={{ color: "var(--fg-muted)", textAlign: "center", marginTop: 24 }}>
            {t("spell.checking")}
          </p>
        )}
        {spellLang && !loadErr && errors !== null && visible.length === 0 && (
          <p style={{ color: "var(--build-ok)", textAlign: "center", marginTop: 24, fontWeight: 500 }}>
            ✓ {t("spell.no_errors")}
          </p>
        )}
        {visible.map((err, i) => (
          <div key={i} style={{
            marginBottom: 12, padding: 10,
            background: "var(--bg-app)", borderRadius: "var(--r-md)",
            border: "1px solid var(--border-soft)",
          }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
              <span style={{
                fontWeight: 600, color: "var(--build-err)", fontFamily: "var(--font-mono)",
                fontSize: "var(--fs-base)",
              }}>
                {err.word}
              </span>
              <div style={{ display: "flex", gap: 4 }}>
                <button
                  className="btn btn-ghost btn-sm"
                  style={{ fontSize: "var(--fs-xs)" }}
                  onClick={() => setIgnored((s) => new Set([...s, err.word.toLowerCase()]))}
                >
                  {t("spell.ignore")}
                </button>
                <button
                  className="btn btn-ghost btn-sm"
                  style={{ fontSize: "var(--fs-xs)" }}
                  onClick={() => addToCustomDictionary(err.word)}
                >
                  +{t("spell.add_dictionary")}
                </button>
              </div>
            </div>
            {err.suggestions.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                {err.suggestions.map((s) => (
                  <button
                    key={s}
                    className="btn btn-sm"
                    style={{ fontSize: "var(--fs-xs)" }}
                    onClick={() => onReplace(err.word, s)}
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {errors !== null && visible.length > 0 && (
        <div style={{ padding: "8px 14px", borderTop: "1px solid var(--border-subtle)", color: "var(--fg-muted)", fontSize: "var(--fs-xs)" }}>
          {t(visible.length === 1 ? "spell.errors_found_one" : "spell.errors_found_other", { count: visible.length })}
        </div>
      )}
    </aside>
  );
}
