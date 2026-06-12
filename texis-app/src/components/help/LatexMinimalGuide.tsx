import { useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../../lib/tauri";

interface ResourceLink {
  url: string;
  label?: string;
  labelKey?: string;
  descKey: string;
  lang: string;
}

interface Section {
  id: string;
  titleKey: string;
  items?: { exampleLatex: string; outputHint: string; noteKey?: string }[];
  links?: ResourceLink[];
}

const SECTIONS: Section[] = [
  {
    id: "math-modes",
    titleKey: "help.latex.math_title",
    items: [
      { exampleLatex: "$x^2 + 1 = 0$",                          outputHint: "x² + 1 = 0", noteKey: "help.latex.hint_inline" },
      { exampleLatex: "\\( x^2 + 1 = 0 \\)",                   outputHint: "x² + 1 = 0", noteKey: "help.latex.hint_inline_alt" },
      { exampleLatex: "\\[ x^2 + 1 = 0 \\]",                   outputHint: "x² + 1 = 0", noteKey: "help.latex.hint_display" },
      { exampleLatex: "\\begin{equation*}…\\end{equation*}", outputHint: "x² + 1 = 0", noteKey: "help.latex.hint_display_alt" },
      { exampleLatex: "\\begin{equation}…\\end{equation}",       outputHint: "(1)",         noteKey: "help.latex.hint_equation" },
      { exampleLatex: "\\begin{align}…\\end{align}",             outputHint: "↕",           noteKey: "help.latex.hint_align" },
    ],
  },
  {
    id: "braces",
    titleKey: "help.latex.braces_title",
    items: [
      { exampleLatex: "\\frac{a}{b}", outputHint: "a ÷ b", noteKey: "help.latex.hint_frac" },
      { exampleLatex: "\\sqrt{x+1}", outputHint: "√(x+1)" },
      { exampleLatex: "e^{2x}", outputHint: "e²ˣ", noteKey: "help.latex.hint_exp" },
      { exampleLatex: "x_{n+1}", outputHint: "xₙ₊₁", noteKey: "help.latex.hint_sub" },
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
      { exampleLatex: "x^{n-1}", outputHint: "xⁿ⁻¹", noteKey: "help.latex.hint_curly" },
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
      { exampleLatex: "sin(x)", outputHint: "sin(x)", noteKey: "help.latex.hint_sin" },
      { exampleLatex: "x^2 - 3*x + 2", outputHint: "x²−3x+2", noteKey: "help.latex.hint_quad" },
      { exampleLatex: "exp(-x^2)", outputHint: "e^(−x²)" },
      { exampleLatex: "ln(x)", outputHint: "ln(x)", noteKey: "help.latex.hint_ln" },
      { exampleLatex: "sqrt(x)", outputHint: "√x", noteKey: "help.latex.hint_sqrt" },
    ],
  },
  {
    id: "chemistry",
    titleKey: "help.latex.chemistry_title",
    items: [
      { exampleLatex: "H_2O", outputHint: "H₂O" },
      { exampleLatex: "CO_2", outputHint: "CO₂" },
      { exampleLatex: "\\rightarrow", outputHint: "→", noteKey: "help.latex.hint_arrow" },
      { exampleLatex: "\\rightleftharpoons", outputHint: "⇌", noteKey: "help.latex.hint_eq" },
    ],
  },
  {
    id: "special",
    titleKey: "help.latex.special_title",
    items: [
      { exampleLatex: "\\%", outputHint: "%", noteKey: "help.latex.hint_pct" },
      { exampleLatex: "\\$", outputHint: "$", noteKey: "help.latex.hint_dollar" },
      { exampleLatex: "\\&", outputHint: "&", noteKey: "help.latex.hint_amp" },
      { exampleLatex: "\\_", outputHint: "_", noteKey: "help.latex.hint_under" },
      { exampleLatex: "\\{  \\}", outputHint: "{ }", noteKey: "help.latex.hint_braces" },
    ],
  },
  {
    id: "errors",
    titleKey: "help.latex.errors_title",
    items: [
      { exampleLatex: "! Missing $ inserted", outputHint: "$…$", noteKey: "help.latex.err_dollar" },
      { exampleLatex: "! Undefined control sequence", outputHint: "\\cmd", noteKey: "help.latex.err_undef" },
      { exampleLatex: "! Missing } inserted", outputHint: "{ }", noteKey: "help.latex.err_brace" },
      { exampleLatex: "! Extra }, or forgotten $", outputHint: "}", noteKey: "help.latex.err_extra" },
    ],
  },
  {
    id: "resources",
    titleKey: "help.latex.resources_title",
    links: [
      { url: "https://gonzaloanddev.github.io/TeXisStudio/latex/basic/",        labelKey: "help.latex.res_wiki_beginner_label",     descKey: "help.latex.res_wiki_beginner_desc",     lang: "TS" },
      { url: "https://gonzaloanddev.github.io/TeXisStudio/latex/intermediate/", labelKey: "help.latex.res_wiki_intermediate_label", descKey: "help.latex.res_wiki_intermediate_desc", lang: "TS" },
      { url: "https://gonzaloanddev.github.io/TeXisStudio/latex/advanced/",     labelKey: "help.latex.res_wiki_advanced_label",     descKey: "help.latex.res_wiki_advanced_desc",     lang: "TS" },
      { url: "https://www.overleaf.com/learn",      label: "Overleaf Learn",                   descKey: "help.latex.res_overleaf_desc",    lang: "EN" },
      { url: "https://ctan.org/pkg/lshort-english", label: "lshort — Not So Short Intro",      descKey: "help.latex.res_lshort_en_desc",   lang: "EN" },
      { url: "https://en.wikibooks.org/wiki/LaTeX", label: "LaTeX Wikibook",                   descKey: "help.latex.res_wikibook_en_desc", lang: "EN" },
      { url: "https://ctan.org/pkg/lshort-spanish", label: "lshort — Introducción en español", descKey: "help.latex.res_lshort_es_desc",   lang: "ES" },
      { url: "https://es.wikibooks.org/wiki/LaTeX", label: "Wikibooks LaTeX en español",       descKey: "help.latex.res_wikibook_es_desc", lang: "ES" },
      { url: "https://ctan.org/pkg/lshort-zh-cn",   label: "lshort-zh-cn（一份简短的介绍）",  descKey: "help.latex.res_lshort_zh_desc",   lang: "ZH" },
      { url: "https://ctan.org/pkg/lshort-french",  label: "lshort — Intro en français",      descKey: "help.latex.res_lshort_fr_desc",   lang: "FR" },
    ],
  },
];

export function LatexMinimalGuide() {
  const { t } = useTranslation();
  const [openSection, setOpenSection] = useState<string | null>("math-modes");

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
              type="button"
              aria-expanded={isOpen}
              aria-controls={`latex-guide-${sec.id}`}
              onClick={() => setOpenSection(isOpen ? null : sec.id)}
              style={{ width: "100%", padding: "7px 12px", background: isOpen ? "var(--bg-hover)" : "var(--bg-app)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 8, fontSize: "var(--fs-xs)", color: "var(--fg-default)", textAlign: "left", fontWeight: isOpen ? 600 : 400 }}
            >
              <span style={{ transform: isOpen ? "rotate(90deg)" : "none", transition: "transform 0.15s", display: "inline-block", fontSize: 9 }}>▶</span>
              {t(sec.titleKey)}
            </button>
            {isOpen && sec.items && (
              <div id={`latex-guide-${sec.id}`} style={{ padding: "8px 12px", display: "flex", flexDirection: "column", gap: 5 }}>
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
            {isOpen && sec.links && (
              <div id={`latex-guide-${sec.id}`} style={{ padding: "8px 12px", display: "flex", flexDirection: "column", gap: 8 }}>
                {sec.links.map((link, i) => (
                  <div key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                    <span style={{ flex: "0 0 26px", fontSize: 10, fontWeight: 700, paddingTop: 3, fontFamily: "var(--font-mono)", letterSpacing: "0.03em", color: link.lang === "TS" ? "var(--fg-accent, #7c6af7)" : "var(--fg-muted)" }}>
                      {link.lang}
                    </span>
                    <div style={{ flex: 1 }}>
                      <button
                        type="button"
                        onClick={() => void api.openInSystem(link.url)}
                        style={{ padding: 0, background: "none", border: "none", cursor: "pointer", fontSize: "var(--fs-xs)", color: "var(--fg-link, #4a9eff)", textDecoration: "none", fontWeight: 500, textAlign: "left" }}
                      >
                        {link.labelKey ? t(link.labelKey) : link.label} ↗
                      </button>
                      <div style={{ fontSize: 10, color: "var(--fg-muted)", marginTop: 1, lineHeight: 1.4 }}>
                        {t(link.descKey)}
                      </div>
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
