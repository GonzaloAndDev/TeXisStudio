// First-launch language picker.
// Shows when "tx-welcome-v1" is not set in localStorage.
// Bundled languages activate immediately; remote ones are downloaded via the
// language-pack store before activating.

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { SUPPORTED_LANGUAGES, SPELL_CHECK_LANGS, ensureDynamicLocale } from "../i18n/index";
import { useSettingsStore } from "../stores/settings";
import { useLangPacksStore } from "../stores/languagePacks";
import type { LangPackEntry } from "../types";
import { TxLogo } from "../components/Chrome";
import { WELCOME_SHOWN_KEY } from "../constants/welcome";

export default function WelcomeView() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { setLang, setSpellLang, setUserMode } = useSettingsStore();
  const { catalog, catalogLoading, catalogError, loadCatalog, install, installing } = useLangPacksStore();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [installError, setInstallError] = useState(false);
  // Two-step onboarding: pick a language, then pick a working mode. Keeping both
  // steps in one route (instead of a second /welcome-mode route) means the
  // WELCOME_SHOWN_KEY guard in App.tsx stays a single gate — the flow is only
  // "done" once a mode is chosen.
  const [step, setStep] = useState<"lang" | "mode">("lang");

  useEffect(() => { loadCatalog(); }, [loadCatalog]);

  const bundledCodes = new Set(SUPPORTED_LANGUAGES.map((l) => l.code));
  const remoteLangs = (catalog?.packages ?? []).filter(
    (p) => p.capabilities.ui && !bundledCodes.has(p.id),
  );

  async function pick(code: string, remote?: LangPackEntry) {
    setInstallError(false);
    setActiveId(code);
    if (remote) {
      try {
        await install(remote);
      } catch {
        setInstallError(true);
        setActiveId(null);
        return;
      }
    }
    await ensureDynamicLocale(code);
    setLang(code);
    void i18n.changeLanguage(code);
    const bundledSpellCode = SPELL_CHECK_LANGS[code];
    if (bundledSpellCode !== undefined) {
      setSpellLang(bundledSpellCode);
    } else if (remote?.capabilities.spelling) {
      setSpellLang(code);
    } else if (remote) {
      setSpellLang(null);
    }
    // Language chosen — advance to the mode step instead of finishing.
    setActiveId(null);
    setStep("mode");
  }

  function finish(mode: "basic" | "advanced") {
    setUserMode(mode);
    localStorage.setItem(WELCOME_SHOWN_KEY, "1");
    navigate("/", { replace: true });
  }

  function skip() {
    // Skipping the language step keeps whatever mode default the store already
    // has (basic). We still mark onboarding as shown so it doesn't reappear.
    localStorage.setItem(WELCOME_SHOWN_KEY, "1");
    navigate("/", { replace: true });
  }

  const isBusy = (code: string) => activeId === code || installing.has(code);

  if (step === "mode") {
    return <ModeStep t={t} onPick={finish} onBack={() => setStep("lang")} />;
  }

  return (
    <div style={{
      minHeight: "100vh",
      overflowY: "auto",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "safe center", // centra si cabe; top-align con scroll si desborda
      background: "var(--bg-app)",
      padding: "40px 24px",
    }}>
      <div style={{ marginBottom: 28 }}>
        <TxLogo />
      </div>

      <h1 style={{
        fontFamily: "var(--font-display)",
        fontSize: "var(--fs-2xl)",
        fontWeight: 400,
        color: "var(--fg-strong)",
        letterSpacing: "-0.015em",
        textAlign: "center",
        margin: "0 0 8px",
      }}>
        {t("welcome.heading")}
      </h1>
      <p style={{ color: "var(--fg-muted)", fontSize: "var(--fs-sm)", textAlign: "center", margin: "0 0 36px" }}>
        {t("welcome.subheading")}
      </p>

      {/* Bundled languages */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))",
        gap: 10,
        maxWidth: 500,
        width: "100%",
      }}>
        {SUPPORTED_LANGUAGES.map((lang) => (
          <LangCard
            key={lang.code}
            flag={lang.flag}
            label={lang.label}
            code={lang.code}
            remote={false}
            busy={isBusy(lang.code)}
            onClick={() => pick(lang.code)}
          />
        ))}
      </div>

      {/* Remote / community languages */}
      {remoteLangs.length > 0 && (
        <div style={{ marginTop: 28, width: "100%", maxWidth: 500 }}>
          <div style={{
            fontSize: "var(--fs-xs)",
            fontWeight: 600,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            color: "var(--fg-faint)",
            textAlign: "center",
            marginBottom: 10,
          }}>
            {t("welcome.more_languages")}
          </div>
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))",
            gap: 8,
          }}>
            {remoteLangs.map((lang) => (
              <LangCard
                key={lang.id}
                flag={lang.flag}
                label={lang.native_name}
                code={lang.id}
                remote
                busy={isBusy(lang.id)}
                onClick={() => pick(lang.id, lang)}
              />
            ))}
          </div>
        </div>
      )}

      {catalogLoading && remoteLangs.length === 0 && (
        <div style={{ marginTop: 20, fontSize: "var(--fs-xs)", color: "var(--fg-faint)" }}>
          {t("welcome.loading_more")}
        </div>
      )}

      {catalogError && (
        <div style={{ marginTop: 12, fontSize: "var(--fs-xs)", color: "var(--fg-faint)", textAlign: "center", maxWidth: 360 }}>
          {t("welcome.catalog_error")}
        </div>
      )}

      {installError && (
        <div style={{ marginTop: 12, fontSize: "var(--fs-xs)", color: "var(--build-err)", textAlign: "center", maxWidth: 360 }}>
          {t("welcome.install_error")}
        </div>
      )}

      <button
        className="btn btn-ghost btn-sm"
        style={{ marginTop: 32, color: "var(--fg-faint)" }}
        onClick={skip}
      >
        {t("welcome.skip")}
      </button>
    </div>
  );
}

interface ModeStepProps {
  t: (key: string) => string;
  onPick: (mode: "basic" | "advanced") => void;
  onBack: () => void;
}

function ModeStep({ t, onPick, onBack }: ModeStepProps) {
  return (
    <div style={{
      minHeight: "100vh",
      overflowY: "auto",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "safe center",
      background: "var(--bg-app)",
      padding: "40px 24px",
    }}>
      <div style={{ marginBottom: 28 }}>
        <TxLogo />
      </div>

      <h1 style={{
        fontFamily: "var(--font-display)",
        fontSize: "var(--fs-2xl)",
        fontWeight: 400,
        color: "var(--fg-strong)",
        letterSpacing: "-0.015em",
        textAlign: "center",
        margin: "0 0 8px",
      }}>
        {t("welcome.mode_heading")}
      </h1>
      <p style={{ color: "var(--fg-muted)", fontSize: "var(--fs-sm)", textAlign: "center", margin: "0 0 36px" }}>
        {t("welcome.mode_subheading")}
      </p>

      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
        gap: 14,
        maxWidth: 620,
        width: "100%",
      }}>
        <ModeCard
          title={t("welcome.mode_basic_title")}
          desc={t("welcome.mode_basic_desc")}
          badge={t("welcome.mode_recommended")}
          onClick={() => onPick("basic")}
        />
        <ModeCard
          title={t("welcome.mode_advanced_title")}
          desc={t("welcome.mode_advanced_desc")}
          onClick={() => onPick("advanced")}
        />
      </div>

      <button
        className="btn btn-ghost btn-sm"
        style={{ marginTop: 32, color: "var(--fg-faint)" }}
        onClick={onBack}
      >
        {t("welcome.back")}
      </button>
    </div>
  );
}

interface ModeCardProps {
  title: string;
  desc: string;
  badge?: string;
  onClick: () => void;
}

function ModeCard({ title, desc, badge, onClick }: ModeCardProps) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
        gap: 8,
        padding: "22px 20px",
        background: "var(--bg-panel)",
        border: "1px solid var(--border-soft)",
        borderRadius: "var(--r-lg)",
        cursor: "pointer",
        transition: "border-color 0.12s, box-shadow 0.12s",
        textAlign: "left",
        position: "relative",
        outline: "none",
        minHeight: 150,
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--accent)";
        (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 0 0 2px var(--accent-soft)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--border-soft)";
        (e.currentTarget as HTMLButtonElement).style.boxShadow = "none";
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, width: "100%" }}>
        <span style={{ fontFamily: "var(--font-display)", fontSize: "var(--fs-lg)", fontWeight: 600, color: "var(--fg-strong)" }}>
          {title}
        </span>
        {badge && (
          <span style={{
            marginLeft: "auto",
            fontSize: 9,
            fontWeight: 700,
            letterSpacing: "0.04em",
            background: "var(--accent-tint)",
            color: "var(--accent-deep)",
            borderRadius: 3,
            padding: "2px 6px",
            textTransform: "uppercase",
          }}>
            {badge}
          </span>
        )}
      </div>
      <span style={{ fontSize: "var(--fs-sm)", color: "var(--fg-muted)", lineHeight: 1.55 }}>
        {desc}
      </span>
    </button>
  );
}

interface LangCardProps {
  flag: string;
  label: string;
  code: string;
  remote: boolean;
  busy: boolean;
  onClick: () => void;
}

function LangCard({ flag, label, code, remote, busy, onClick }: LangCardProps) {
  return (
    <button
      onClick={onClick}
      disabled={busy}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 5,
        padding: "16px 10px",
        background: "var(--bg-panel)",
        border: "1px solid var(--border-soft)",
        borderRadius: "var(--r-lg)",
        cursor: busy ? "wait" : "pointer",
        transition: "border-color 0.12s, box-shadow 0.12s, opacity 0.12s",
        opacity: busy ? 0.6 : 1,
        position: "relative",
        outline: "none",
      }}
      onMouseEnter={(e) => {
        if (!busy) {
          (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--accent)";
          (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 0 0 2px var(--accent-soft)";
        }
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--border-soft)";
        (e.currentTarget as HTMLButtonElement).style.boxShadow = "none";
      }}
    >
      <span style={{ fontSize: 26 }}>{flag}</span>
      <span style={{ fontSize: "var(--fs-sm)", fontWeight: 500, color: "var(--fg-strong)", textAlign: "center", lineHeight: 1.2 }}>
        {label}
      </span>
      <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--fg-faint)" }}>
        {code}
      </span>
      {remote && !busy && (
        <span style={{
          position: "absolute",
          top: 5,
          right: 5,
          fontSize: 8,
          fontWeight: 700,
          letterSpacing: "0.04em",
          background: "var(--accent-tint)",
          color: "var(--accent-deep)",
          borderRadius: 3,
          padding: "1px 4px",
          textTransform: "uppercase",
        }}>
          DL
        </span>
      )}
      {busy && (
        <span style={{
          position: "absolute",
          top: 5,
          right: 5,
          fontSize: 11,
          color: "var(--fg-faint)",
          animation: "spin 1s linear infinite",
        }}>
          ⟳
        </span>
      )}
    </button>
  );
}
