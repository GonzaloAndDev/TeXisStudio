import { useState } from "react";
import { useTranslation } from "react-i18next";
import { checkGrammar, GrammarMatch } from "../services/grammar";
import { useSettingsStore } from "../stores/settings";
import { useLangPacksStore } from "../stores/languagePacks";
import { LT_LANG_CODES } from "../i18n/index";

interface Props {
  text: string;
  onAccept: (match: GrammarMatch, replacement: string) => void;
  onClose: () => void;
}

// Only English and Spanish remain bundled in the app by default.
// Any other grammar-capable language must come from an installed pack.
const BUNDLED_GRAMMAR_LANGS = new Set(["es", "en"]);

export function GrammarPanel({ text, onAccept, onClose }: Props) {
  const { t } = useTranslation();
  const { lang, grammarAutoCheck, setGrammarAutoCheck } = useSettingsStore();
  const { installed } = useLangPacksStore();
  const [matches, setMatches] = useState<GrammarMatch[] | null>(null);
  const [dismissed, setDismissed] = useState<Set<number>>(new Set());
  const [busy, setBusy] = useState(false);
  const [apiError, setApiError] = useState(false);

  // ── Capability check ──────────────────────────────────────────────────────
  // Verify grammar is available for this language before doing anything.
  // Community packs must declare capabilities.grammar_remote = true.
  // Bundled langs use a hardcoded allow-list; never fall back to "es" for other langs.
  const installedPack = installed.find((p) => p.id === lang);
  const grammarAvailable = installedPack
    ? installedPack.entry.capabilities.grammar_remote
    : BUNDLED_GRAMMAR_LANGS.has(lang);

  // Never use a fallback language — if we don't have a real LT code, don't call.
  const ltLang = LT_LANG_CODES[lang] ?? null;
  const canCheck = grammarAvailable && ltLang !== null;

  async function runCheck() {
    if (!canCheck) return;
    setBusy(true);
    setApiError(false);
    setDismissed(new Set());
    try {
      const result = await checkGrammar(text, ltLang!);
      setMatches(result.matches);
    } catch {
      setApiError(true);
    } finally {
      setBusy(false);
    }
  }

  const visible = matches?.filter((_, i) => !dismissed.has(i)) ?? [];

  return (
    <aside style={{
      width: 300, flexShrink: 0, borderLeft: "1px solid var(--border-subtle)",
      background: "var(--bg-panel)", display: "flex", flexDirection: "column",
      fontSize: "var(--fs-sm)",
    }}>
      {/* Header */}
      <div style={{
        padding: "10px 14px", borderBottom: "1px solid var(--border-subtle)",
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <span style={{ fontWeight: 600, color: "var(--fg-strong)" }}>
          {t("grammar.panel_title")}
        </span>
        <button className="btn btn-ghost btn-icon btn-sm" onClick={onClose}>✕</button>
      </div>

      {/* Not available notice */}
      {!canCheck && (
        <div style={{
          padding: "16px 14px", color: "var(--fg-muted)", textAlign: "center",
          lineHeight: 1.5, fontSize: "var(--fs-xs)",
        }}>
          <div style={{ fontSize: "1.5em", marginBottom: 8 }}>🔇</div>
          <div style={{ fontWeight: 500, color: "var(--fg-default)", marginBottom: 4 }}>
            {t("lang.spell_not_available")}
          </div>
          <div>{t("grammar.not_supported", { language: lang.toUpperCase() })}</div>
          {installedPack && (
            <div style={{ marginTop: 4, color: "var(--fg-faint)" }}>
              {t("grammar.pack_remote_disabled_prefix")} <code>grammar_remote: false</code>
            </div>
          )}
        </div>
      )}

      {/* Normal grammar UI — only shown when grammar is available */}
      {canCheck && (
        <>
          {/* Privacy + LanguageTool credit */}
          <div style={{
            padding: "8px 14px", borderBottom: "1px solid var(--border-subtle)",
            background: "var(--accent-tint)", fontSize: "var(--fs-xs)", color: "var(--fg-muted)",
            display: "flex", flexDirection: "column", gap: 2,
          }}>
            <span style={{ fontWeight: 500, color: "var(--accent-deep)" }}>{t("grammar.powered_by")}</span>
            <span>{t("grammar.privacy_notice")}</span>
          </div>

          <div style={{
            padding: "10px 14px", borderBottom: "1px solid var(--border-subtle)",
            background: "var(--bg-panel)", fontSize: "var(--fs-xs)", color: "var(--fg-muted)", lineHeight: 1.6,
          }}>
            <div style={{ fontWeight: 600, color: "var(--fg-default)", marginBottom: 4 }}>
              {t("grammar.guided_title")}
            </div>
            <div>{t("grammar.guided_body")}</div>
          </div>

          {/* Auto-check toggle */}
          <label style={{
            padding: "8px 14px", borderBottom: "1px solid var(--border-subtle)",
            display: "flex", alignItems: "center", gap: 8, cursor: "pointer",
          }}>
            <input
              type="checkbox"
              checked={grammarAutoCheck}
              onChange={(e) => setGrammarAutoCheck(e.target.checked)}
            />
            <span style={{ color: "var(--fg-default)" }}>{t("grammar.auto_check")}</span>
          </label>

          {/* Check now button */}
          <div style={{ padding: "8px 14px", borderBottom: "1px solid var(--border-subtle)" }}>
            <button
              className="btn btn-accent"
              style={{ width: "100%", justifyContent: "center" }}
              onClick={runCheck}
              disabled={busy}
            >
              {busy ? t("grammar.checking") : t("grammar.check_now")}
            </button>
          </div>

          {/* Results */}
          <div className="scroll" style={{ flex: 1, overflow: "auto", padding: "8px 14px" }}>
            {apiError && (
              <p style={{ color: "var(--build-err)", textAlign: "center", marginTop: 24 }}>
                {t("grammar.error_api")}
              </p>
            )}
            {!apiError && matches === null && !busy && (
              <p style={{ color: "var(--fg-muted)", textAlign: "center", marginTop: 24 }}>
                {t("grammar.check_now")} →
              </p>
            )}
            {!apiError && matches !== null && visible.length === 0 && (
              <p style={{ color: "var(--build-ok)", textAlign: "center", marginTop: 24, fontWeight: 500 }}>
                ✓ {t("grammar.no_errors")}
              </p>
            )}
            {visible.map((m, idx) => {
              const realIdx = matches!.indexOf(m);
              return (
                <div key={idx} style={{
                  marginBottom: 12, padding: 10,
                  background: "var(--bg-app)", borderRadius: "var(--r-md)",
                  border: "1px solid var(--border-soft)",
                }}>
                  <div style={{ color: "var(--fg-default)", marginBottom: 6, lineHeight: 1.4 }}>
                    {m.message}
                  </div>
                  <div style={{
                    fontFamily: "var(--font-mono)", fontSize: "var(--fs-xs)",
                    color: "var(--fg-muted)", marginBottom: 8,
                    background: "var(--bg-chrome)", borderRadius: "var(--r-sm)",
                    padding: "4px 6px", lineHeight: 1.5,
                  }}>
                    …{m.context.slice(Math.max(0, m.contextOffset - 20), m.contextOffset)}
                    <mark style={{ background: "var(--accent-tint)", borderRadius: 2 }}>
                      {m.context.slice(m.contextOffset, m.contextOffset + m.length)}
                    </mark>
                    {m.context.slice(m.contextOffset + m.length, m.contextOffset + m.length + 20)}…
                  </div>
                  <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                    {m.replacements.map((r) => (
                      <button
                        key={r}
                        className="btn btn-sm btn-accent"
                        style={{ fontSize: "var(--fs-xs)" }}
                        onClick={() => { onAccept(m, r); setDismissed((s) => new Set([...s, realIdx])); }}
                      >
                        {r}
                      </button>
                    ))}
                    <button
                      className="btn btn-ghost btn-sm"
                      style={{ fontSize: "var(--fs-xs)", marginLeft: "auto" }}
                      onClick={() => setDismissed((s) => new Set([...s, realIdx]))}
                    >
                      {t("grammar.dismiss")}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {matches !== null && (
            <div style={{ padding: "8px 14px", borderTop: "1px solid var(--border-subtle)", color: "var(--fg-muted)", fontSize: "var(--fs-xs)" }}>
              {t(visible.length === 1 ? "grammar.errors_found_one" : "grammar.errors_found_other", { count: visible.length })}
            </div>
          )}
        </>
      )}
    </aside>
  );
}
