/**
 * Centro de ayuda local — sin conexión.
 * Accesible desde el botón de ayuda en Chrome.tsx y desde
 * cualquier editor de figura avanzado.
 *
 * Secciones: Primeros pasos · Figuras · LaTeX mínimo · Errores frecuentes
 */
import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { LatexMinimalGuide } from "./LatexMinimalGuide";

type HelpSection = "start" | "figures" | "latex" | "errors" | "faq";

const SECTIONS: { id: HelpSection; icon: string; titleKey: string }[] = [
  { id: "start",   icon: "🚀", titleKey: "help.section_start"   },
  { id: "figures", icon: "📊", titleKey: "help.section_figures" },
  { id: "latex",   icon: "∑",  titleKey: "help.section_latex"   },
  { id: "errors",  icon: "⚠",  titleKey: "help.section_errors"  },
  { id: "faq",     icon: "❓", titleKey: "help.section_faq"     },
];

interface Props {
  onClose: () => void;
  /** Jump to a specific section on open. */
  initialSection?: HelpSection;
}

export function HelpCenter({ onClose, initialSection = "start" }: Props) {
  const { t } = useTranslation();
  const [active, setActive] = useState<HelpSection>(initialSection);

  useEffect(() => {
    setActive(initialSection);
  }, [initialSection]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  return (
    <div
      style={{ position: "fixed", inset: 0, zIndex: 10000, background: "rgba(0,0,0,0.55)", display: "flex", alignItems: "center", justifyContent: "center" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{ width: "min(860px, 96vw)", height: "min(640px, 90vh)", background: "var(--bg-panel)", border: "1px solid var(--border-firm)", borderRadius: 10, boxShadow: "0 24px 64px rgba(0,0,0,0.45)", display: "flex", overflow: "hidden" }}>

        {/* Sidebar */}
        <div style={{ width: 180, flexShrink: 0, borderRight: "1px solid var(--border-subtle)", display: "flex", flexDirection: "column", background: "var(--bg-app)" }}>
          <div style={{ padding: "14px 14px 10px", borderBottom: "1px solid var(--border-subtle)" }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: "var(--fg-strong)" }}>{t("help.title")}</div>
            <div style={{ fontSize: 10, color: "var(--fg-faint)", marginTop: 2 }}>{t("help.subtitle")}</div>
          </div>
          <nav style={{ flex: 1, padding: "8px 6px", display: "flex", flexDirection: "column", gap: 2 }}>
            {SECTIONS.map((sec) => (
              <button
                key={sec.id}
                onClick={() => setActive(sec.id)}
                style={{
                  display: "flex", alignItems: "center", gap: 8, padding: "7px 10px",
                  borderRadius: "var(--r-sm)", border: "none",
                  background: active === sec.id ? "var(--accent-tint, rgba(0,122,255,0.1))" : "transparent",
                  color: active === sec.id ? "var(--accent)" : "var(--fg-muted)",
                  cursor: "pointer", fontSize: "var(--fs-xs)", fontWeight: active === sec.id ? 600 : 400,
                  textAlign: "left", width: "100%",
                }}
              >
                <span style={{ fontSize: 13 }}>{sec.icon}</span>
                {t(sec.titleKey)}
              </button>
            ))}
          </nav>
          <div style={{ padding: "8px 10px", borderTop: "1px solid var(--border-subtle)", fontSize: 9, color: "var(--fg-faint)" }}>
            {t("help.offline_badge")}
          </div>
        </div>

        {/* Content */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          <div style={{ padding: "12px 18px 10px", borderBottom: "1px solid var(--border-subtle)", display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
            <span style={{ fontSize: 16 }}>{SECTIONS.find((s) => s.id === active)?.icon}</span>
            <span style={{ fontSize: 14, fontWeight: 600, color: "var(--fg-strong)" }}>
              {t(SECTIONS.find((s) => s.id === active)?.titleKey ?? "")}
            </span>
            <button className="btn btn-ghost btn-icon" onClick={onClose} style={{ marginLeft: "auto" }} title={t("figure_picker.close_title")}>✕</button>
          </div>

          <div style={{ flex: 1, overflowY: "auto", padding: "14px 18px" }}>
            {active === "start"   && <StartSection />}
            {active === "figures" && <FiguresSection />}
            {active === "latex"   && <LatexMinimalGuide />}
            {active === "errors"  && <ErrorsSection />}
            {active === "faq"     && <FAQSection />}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Sections ──────────────────────────────────────────────────────

function StartSection() {
  const { t } = useTranslation();
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <p style={bodyText}>{t("help.start.intro")}</p>
      <Steps steps={[
        t("help.start.step1"),
        t("help.start.step2"),
        t("help.start.step3"),
        t("help.start.step4"),
        t("help.start.step5"),
      ]} />
      <Tip>{t("help.start.tip")}</Tip>
    </div>
  );
}

function FiguresSection() {
  const { t } = useTranslation();
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <p style={bodyText}>{t("help.figures.intro")}</p>
      <ul style={{ paddingLeft: 18, margin: 0, display: "flex", flexDirection: "column", gap: 6 }}>
        <li style={bodyText}><strong>{t("help.figures.easy_label")}</strong> — {t("help.figures.easy_desc")}</li>
        <li style={bodyText}><strong>{t("help.figures.intermediate_label")}</strong> — {t("help.figures.intermediate_desc")}</li>
        <li style={bodyText}><strong>{t("help.figures.advanced_label")}</strong> — {t("help.figures.advanced_desc")}</li>
      </ul>
      <Tip>{t("help.figures.tip")}</Tip>
      <p style={bodyText}>{t("help.figures.visual_editor_desc")}</p>
    </div>
  );
}

function ErrorsSection() {
  const { t } = useTranslation();
  const errs: [string, string][] = [
    [t("help.errors.compile_fail_q"), t("help.errors.compile_fail_a")],
    [t("help.errors.missing_pkg_q"),  t("help.errors.missing_pkg_a")],
    [t("help.errors.no_preview_q"),   t("help.errors.no_preview_a")],
    [t("help.errors.weird_chars_q"),  t("help.errors.weird_chars_a")],
  ];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {errs.map(([q, a], i) => (
        <div key={i} style={{ background: "var(--bg-app)", border: "1px solid var(--border-soft)", borderRadius: "var(--r-sm)", padding: "10px 12px" }}>
          <div style={{ fontWeight: 600, fontSize: "var(--fs-xs)", color: "var(--fg-strong)", marginBottom: 4 }}>❓ {q}</div>
          <div style={{ fontSize: "var(--fs-xs)", color: "var(--fg-muted)", lineHeight: 1.55 }}>{a}</div>
        </div>
      ))}
    </div>
  );
}

function FAQSection() {
  const { t } = useTranslation();
  const items: [string, string][] = [
    [t("help.faq.q1"), t("help.faq.a1")],
    [t("help.faq.q2"), t("help.faq.a2")],
    [t("help.faq.q3"), t("help.faq.a3")],
    [t("help.faq.q4"), t("help.faq.a4")],
  ];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {items.map(([q, a], i) => (
        <div key={i} style={{ borderBottom: i < items.length - 1 ? "1px solid var(--border-subtle)" : "none", paddingBottom: 12 }}>
          <div style={{ fontWeight: 600, fontSize: "var(--fs-sm)", color: "var(--fg-default)", marginBottom: 4 }}>{q}</div>
          <div style={{ fontSize: "var(--fs-xs)", color: "var(--fg-muted)", lineHeight: 1.6 }}>{a}</div>
        </div>
      ))}
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────

function Steps({ steps }: { steps: string[] }) {
  return (
    <ol style={{ paddingLeft: 20, margin: 0, display: "flex", flexDirection: "column", gap: 6 }}>
      {steps.map((s, i) => (
        <li key={i} style={{ fontSize: "var(--fs-xs)", color: "var(--fg-default)", lineHeight: 1.55 }}>{s}</li>
      ))}
    </ol>
  );
}

function Tip({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", gap: 8, padding: "8px 12px", background: "var(--accent-tint, rgba(0,122,255,0.07))", borderRadius: "var(--r-sm)", border: "1px solid var(--accent-soft, rgba(0,122,255,0.2))" }}>
      <span style={{ fontSize: 14, flexShrink: 0 }}>💡</span>
      <span style={{ fontSize: "var(--fs-xs)", color: "var(--fg-muted)", lineHeight: 1.5 }}>{children}</span>
    </div>
  );
}

const bodyText: React.CSSProperties = { fontSize: "var(--fs-xs)", color: "var(--fg-default)", lineHeight: 1.65, margin: 0 };
