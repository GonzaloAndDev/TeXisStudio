/**
 * Guía "LaTeX mínimo" integrada en la app.
 * Cubre exactamente lo que necesita un usuario de TeXisStudio: llaves,
 * comandos, subíndices, fracciones, símbolos, expresiones para gráficas,
 * caracteres especiales y lectura básica de errores.
 * Sin conexión — todo el contenido está aquí.
 */
import { useState } from "react";
import { useTranslation } from "react-i18next";

interface Section {
  id: string;
  titleKey: string;
  items: { exampleLatex: string; outputHint: string; noteKey?: string }[];
}

const SECTIONS: Section[] = [
  {
    id: "braces",
    titleKey: "help.latex.braces_title",
    items: [
      { exampleLatex: "\\frac{a}{b}", outputHint: "a ÷ b as fraction" },
      { exampleLatex: "\\sqrt{x+1}", outputHint: "√(x+1)" },
      { exampleLatex: "e^{2x}", outputHint: "e raised to 2x" },
      { exampleLatex: "x_{n+1}", outputHint: "x subscript n+1" },
    ],
  },
  {
    id: "commands",
    titleKey: "help.latex.commands_title",
    items: [
      { exampleLatex: "\\alpha, \\beta, \\gamma", outputHint: "α, β, γ" },
      { exampleLatex: "\\pi, \\theta, \\lambda", outputHint: "π, θ, λ" },
      { exampleLatex: "\\infty", outputHint: "∞" },
      { exampleLatex: "\\pm, \\times, \\div", outputHint: "±, ×, ÷" },
      { exampleLatex: "\\leq, \\geq, \\neq", outputHint: "≤, ≥, ≠" },
      { exampleLatex: "\\approx, \\equiv", outputHint: "≈, ≡" },
    ],
  },
  {
    id: "sub-super",
    titleKey: "help.latex.subsup_title",
    items: [
      { exampleLatex: "x^2", outputHint: "x²" },
      { exampleLatex: "x_i", outputHint: "xᵢ" },
      { exampleLatex: "x^{n-1}", outputHint: "x^(n-1)  (curly braces for >1 char)" },
      { exampleLatex: "x_{ij}", outputHint: "x_ij" },
    ],
  },
  {
    id: "fractions",
    titleKey: "help.latex.fractions_title",
    items: [
      { exampleLatex: "\\frac{1}{2}", outputHint: "½" },
      { exampleLatex: "\\frac{dy}{dx}", outputHint: "dy/dx" },
      { exampleLatex: "\\frac{\\partial f}{\\partial x}", outputHint: "∂f/∂x" },
    ],
  },
  {
    id: "plots",
    titleKey: "help.latex.plots_title",
    items: [
      { exampleLatex: "sin(x)", outputHint: "sine of x (pgfplots)" },
      { exampleLatex: "x^2 - 3*x + 2", outputHint: "quadratic — use * for multiply" },
      { exampleLatex: "exp(-x^2)", outputHint: "e^(-x²)" },
      { exampleLatex: "ln(x)", outputHint: "natural log" },
      { exampleLatex: "sqrt(x)", outputHint: "√x  (pgfplots syntax)" },
    ],
  },
  {
    id: "chemistry",
    titleKey: "help.latex.chemistry_title",
    items: [
      { exampleLatex: "H_2O", outputHint: "H₂O" },
      { exampleLatex: "CO_2", outputHint: "CO₂" },
      { exampleLatex: "\\rightarrow", outputHint: "→ (reaction arrow)" },
      { exampleLatex: "\\rightleftharpoons", outputHint: "⇌ (equilibrium)" },
    ],
  },
  {
    id: "special",
    titleKey: "help.latex.special_title",
    items: [
      { exampleLatex: "\\%", outputHint: "% literal percent" },
      { exampleLatex: "\\$", outputHint: "$ literal dollar sign" },
      { exampleLatex: "\\&", outputHint: "& literal ampersand" },
      { exampleLatex: "\\_", outputHint: "_ literal underscore" },
      { exampleLatex: "\\{  \\}", outputHint: "{ } literal braces" },
    ],
  },
  {
    id: "errors",
    titleKey: "help.latex.errors_title",
    items: [
      { exampleLatex: "! Missing $ inserted", outputHint: "Math mode not started — wrap in $…$", noteKey: "help.latex.err_dollar" },
      { exampleLatex: "! Undefined control sequence", outputHint: "Command typo — check \\command spelling", noteKey: "help.latex.err_undef" },
      { exampleLatex: "! Missing } inserted", outputHint: "Unmatched braces — count { vs }", noteKey: "help.latex.err_brace" },
      { exampleLatex: "! Extra }, or forgotten $", outputHint: "Extra closing brace or unclosed math", noteKey: "help.latex.err_extra" },
    ],
  },
];

export function LatexMinimalGuide() {
  const { t } = useTranslation();
  const [openSection, setOpenSection] = useState<string | null>("braces");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ fontSize: "var(--fs-xs)", color: "var(--fg-muted)", marginBottom: 6, lineHeight: 1.5 }}>
        {t("help.latex.intro")}
      </div>
      {SECTIONS.map((sec) => {
        const isOpen = openSection === sec.id;
        return (
          <div key={sec.id} style={{ border: "1px solid var(--border-soft)", borderRadius: "var(--r-sm)", overflow: "hidden" }}>
            <button
              onClick={() => setOpenSection(isOpen ? null : sec.id)}
              style={{ width: "100%", padding: "7px 12px", background: isOpen ? "var(--bg-hover)" : "var(--bg-app)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 8, fontSize: "var(--fs-xs)", color: "var(--fg-default)", textAlign: "left", fontWeight: isOpen ? 600 : 400 }}
            >
              <span style={{ transform: isOpen ? "rotate(90deg)" : "none", transition: "transform 0.15s", display: "inline-block", fontSize: 9 }}>▶</span>
              {t(sec.titleKey)}
            </button>
            {isOpen && (
              <div style={{ padding: "8px 12px", display: "flex", flexDirection: "column", gap: 5 }}>
                {sec.items.map((item, i) => (
                  <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                    <code style={{ flex: "0 0 auto", minWidth: 180, padding: "3px 7px", background: "var(--ink-900, #14110f)", color: "#aef", borderRadius: "var(--r-xs)", fontSize: 11, fontFamily: "var(--font-mono)", whiteSpace: "nowrap" }}>
                      {item.exampleLatex}
                    </code>
                    <div style={{ flex: 1, fontSize: "var(--fs-xs)", color: "var(--fg-muted)", paddingTop: 3 }}>
                      → {item.noteKey ? t(item.noteKey, item.outputHint) : item.outputHint}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
