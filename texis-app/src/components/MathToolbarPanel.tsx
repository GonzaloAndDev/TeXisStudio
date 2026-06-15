/**
 * MathToolbarPanel — panel lateral de símbolos y operadores matemáticos LaTeX.
 *
 * Permite insertar símbolos en cualquier textarea de matemáticas (EquationEditor,
 * raw_latex) que se haya registrado en mathInsertManager.
 */

import { useEffect, useReducer, useState } from "react";
import { useTranslation } from "react-i18next";
import { mathInsertManager } from "../lib/mathInsertManager";
import { IconX, IconSigma } from "./Icons";

// ── Tipos ─────────────────────────────────────────────────────────────────────

type Category = "greek" | "operators" | "relations" | "arrows" | "structures" | "misc";

interface MathSymbol {
  display: string;
  latex: string;
  title?: string;
}

// ── Datos de categorías ───────────────────────────────────────────────────────

const CATEGORIES: { id: Category; labelKey: string }[] = [
  { id: "greek",      labelKey: "math_toolbar.cat_greek" },
  { id: "operators",  labelKey: "math_toolbar.cat_operators" },
  { id: "relations",  labelKey: "math_toolbar.cat_relations" },
  { id: "arrows",     labelKey: "math_toolbar.cat_arrows" },
  { id: "structures", labelKey: "math_toolbar.cat_structures" },
  { id: "misc",       labelKey: "math_toolbar.cat_misc" },
];

const SYMBOLS: Record<Category, MathSymbol[]> = {
  greek: [
    { display: "α",  latex: "\\alpha",       title: "\\alpha" },
    { display: "β",  latex: "\\beta",        title: "\\beta" },
    { display: "γ",  latex: "\\gamma",       title: "\\gamma" },
    { display: "δ",  latex: "\\delta",       title: "\\delta" },
    { display: "ε",  latex: "\\epsilon",     title: "\\epsilon" },
    { display: "ζ",  latex: "\\zeta",        title: "\\zeta" },
    { display: "η",  latex: "\\eta",         title: "\\eta" },
    { display: "θ",  latex: "\\theta",       title: "\\theta" },
    { display: "ι",  latex: "\\iota",        title: "\\iota" },
    { display: "κ",  latex: "\\kappa",       title: "\\kappa" },
    { display: "λ",  latex: "\\lambda",      title: "\\lambda" },
    { display: "μ",  latex: "\\mu",          title: "\\mu" },
    { display: "ν",  latex: "\\nu",          title: "\\nu" },
    { display: "ξ",  latex: "\\xi",          title: "\\xi" },
    { display: "π",  latex: "\\pi",          title: "\\pi" },
    { display: "ρ",  latex: "\\rho",         title: "\\rho" },
    { display: "σ",  latex: "\\sigma",       title: "\\sigma" },
    { display: "τ",  latex: "\\tau",         title: "\\tau" },
    { display: "υ",  latex: "\\upsilon",     title: "\\upsilon" },
    { display: "φ",  latex: "\\phi",         title: "\\phi" },
    { display: "χ",  latex: "\\chi",         title: "\\chi" },
    { display: "ψ",  latex: "\\psi",         title: "\\psi" },
    { display: "ω",  latex: "\\omega",       title: "\\omega" },
    { display: "ϑ",  latex: "\\vartheta",    title: "\\vartheta" },
    { display: "ϕ",  latex: "\\varphi",      title: "\\varphi" },
    { display: "ϵ",  latex: "\\varepsilon",  title: "\\varepsilon" },
    // Uppercase
    { display: "Γ",  latex: "\\Gamma",       title: "\\Gamma" },
    { display: "Δ",  latex: "\\Delta",       title: "\\Delta" },
    { display: "Θ",  latex: "\\Theta",       title: "\\Theta" },
    { display: "Λ",  latex: "\\Lambda",      title: "\\Lambda" },
    { display: "Ξ",  latex: "\\Xi",          title: "\\Xi" },
    { display: "Π",  latex: "\\Pi",          title: "\\Pi" },
    { display: "Σ",  latex: "\\Sigma",       title: "\\Sigma" },
    { display: "Υ",  latex: "\\Upsilon",     title: "\\Upsilon" },
    { display: "Φ",  latex: "\\Phi",         title: "\\Phi" },
    { display: "Ψ",  latex: "\\Psi",         title: "\\Psi" },
    { display: "Ω",  latex: "\\Omega",       title: "\\Omega" },
  ],

  operators: [
    { display: "∑",   latex: "\\sum",                       title: "\\sum" },
    { display: "∏",   latex: "\\prod",                      title: "\\prod" },
    { display: "∫",   latex: "\\int",                       title: "\\int" },
    { display: "∬",   latex: "\\iint",                      title: "\\iint" },
    { display: "∭",   latex: "\\iiint",                     title: "\\iiint" },
    { display: "∮",   latex: "\\oint",                      title: "\\oint" },
    { display: "∂",   latex: "\\partial",                   title: "\\partial" },
    { display: "∇",   latex: "\\nabla",                     title: "\\nabla" },
    { display: "±",   latex: "\\pm",                        title: "\\pm" },
    { display: "∓",   latex: "\\mp",                        title: "\\mp" },
    { display: "×",   latex: "\\times",                     title: "\\times" },
    { display: "÷",   latex: "\\div",                       title: "\\div" },
    { display: "·",   latex: "\\cdot",                      title: "\\cdot" },
    { display: "∘",   latex: "\\circ",                      title: "\\circ" },
    { display: "⊕",   latex: "\\oplus",                     title: "\\oplus" },
    { display: "⊗",   latex: "\\otimes",                    title: "\\otimes" },
    { display: "lim", latex: "\\lim_{}",                    title: "\\lim_{}" },
    { display: "max", latex: "\\max",                       title: "\\max" },
    { display: "min", latex: "\\min",                       title: "\\min" },
    { display: "sup", latex: "\\sup",                       title: "\\sup" },
    { display: "inf", latex: "\\inf",                       title: "\\inf" },
    { display: "log", latex: "\\log",                       title: "\\log" },
    { display: "ln",  latex: "\\ln",                        title: "\\ln" },
    { display: "exp", latex: "\\exp",                       title: "\\exp" },
    { display: "sin", latex: "\\sin",                       title: "\\sin" },
    { display: "cos", latex: "\\cos",                       title: "\\cos" },
    { display: "tan", latex: "\\tan",                       title: "\\tan" },
    { display: "det", latex: "\\det",                       title: "\\det" },
    { display: "deg", latex: "\\deg",                       title: "\\deg" },
  ],

  relations: [
    { display: "=",  latex: "=",              title: "=" },
    { display: "≠",  latex: "\\neq",          title: "\\neq" },
    { display: "<",  latex: "<",              title: "<" },
    { display: ">",  latex: ">",              title: ">" },
    { display: "≤",  latex: "\\leq",          title: "\\leq" },
    { display: "≥",  latex: "\\geq",          title: "\\geq" },
    { display: "≪",  latex: "\\ll",           title: "\\ll" },
    { display: "≫",  latex: "\\gg",           title: "\\gg" },
    { display: "≈",  latex: "\\approx",       title: "\\approx" },
    { display: "≡",  latex: "\\equiv",        title: "\\equiv" },
    { display: "∼",  latex: "\\sim",          title: "\\sim" },
    { display: "≃",  latex: "\\simeq",        title: "\\simeq" },
    { display: "∝",  latex: "\\propto",       title: "\\propto" },
    { display: "∈",  latex: "\\in",           title: "\\in" },
    { display: "∉",  latex: "\\notin",        title: "\\notin" },
    { display: "⊂",  latex: "\\subset",       title: "\\subset" },
    { display: "⊃",  latex: "\\supset",       title: "\\supset" },
    { display: "⊆",  latex: "\\subseteq",     title: "\\subseteq" },
    { display: "⊇",  latex: "\\supseteq",     title: "\\supseteq" },
    { display: "∪",  latex: "\\cup",          title: "\\cup" },
    { display: "∩",  latex: "\\cap",          title: "\\cap" },
    { display: "∧",  latex: "\\wedge",        title: "\\wedge" },
    { display: "∨",  latex: "\\vee",          title: "\\vee" },
    { display: "∥",  latex: "\\parallel",     title: "\\parallel" },
    { display: "⊥",  latex: "\\perp",         title: "\\perp" },
    { display: "⊢",  latex: "\\vdash",        title: "\\vdash" },
    { display: "⊨",  latex: "\\models",       title: "\\models" },
  ],

  arrows: [
    { display: "→",  latex: "\\to",                       title: "\\to" },
    { display: "←",  latex: "\\leftarrow",                title: "\\leftarrow" },
    { display: "↑",  latex: "\\uparrow",                  title: "\\uparrow" },
    { display: "↓",  latex: "\\downarrow",                title: "\\downarrow" },
    { display: "↔",  latex: "\\leftrightarrow",           title: "\\leftrightarrow" },
    { display: "⇒",  latex: "\\Rightarrow",               title: "\\Rightarrow" },
    { display: "⇐",  latex: "\\Leftarrow",                title: "\\Leftarrow" },
    { display: "⇑",  latex: "\\Uparrow",                  title: "\\Uparrow" },
    { display: "⇓",  latex: "\\Downarrow",                title: "\\Downarrow" },
    { display: "⇔",  latex: "\\Leftrightarrow",           title: "\\Leftrightarrow" },
    { display: "↦",  latex: "\\mapsto",                   title: "\\mapsto" },
    { display: "⟶",  latex: "\\longrightarrow",           title: "\\longrightarrow" },
    { display: "⟵",  latex: "\\longleftarrow",            title: "\\longleftarrow" },
    { display: "⟹",  latex: "\\Longrightarrow",           title: "\\Longrightarrow" },
    { display: "⟸",  latex: "\\Longleftarrow",            title: "\\Longleftarrow" },
    { display: "⟺",  latex: "\\Longleftrightarrow",       title: "\\Longleftrightarrow" },
    { display: "↗",  latex: "\\nearrow",                  title: "\\nearrow" },
    { display: "↘",  latex: "\\searrow",                  title: "\\searrow" },
    { display: "↩",  latex: "\\hookleftarrow",            title: "\\hookleftarrow" },
    { display: "↪",  latex: "\\hookrightarrow",           title: "\\hookrightarrow" },
  ],

  structures: [
    { display: "a/b",     latex: "\\frac{}{}",                                                         title: "\\frac{numerador}{denominador}" },
    { display: "√·",      latex: "\\sqrt{}",                                                           title: "\\sqrt{}" },
    { display: "ⁿ√·",     latex: "\\sqrt[n]{}",                                                        title: "\\sqrt[n]{}" },
    { display: "xⁿ",      latex: "^{}",                                                                title: "superíndice ^{}" },
    { display: "xₙ",      latex: "_{}",                                                                title: "subíndice _{}" },
    { display: "x^n_m",   latex: "^{}_{}",                                                             title: "superíndice + subíndice" },
    { display: "∑ᵢ₌₁ⁿ",   latex: "\\sum_{i=1}^{n}",                                                   title: "\\sum_{i=1}^{n}" },
    { display: "∏ᵢ₌₁ⁿ",   latex: "\\prod_{i=1}^{n}",                                                  title: "\\prod_{i=1}^{n}" },
    { display: "∫ₐᵇ",     latex: "\\int_{a}^{b}",                                                     title: "\\int_{a}^{b}" },
    { display: "lim→",    latex: "\\lim_{x \\to }",                                                    title: "\\lim_{x \\to }" },
    { display: "vec",     latex: "\\vec{}",                                                            title: "\\vec{}" },
    { display: "hat",     latex: "\\hat{}",                                                            title: "\\hat{}" },
    { display: "bar",     latex: "\\bar{}",                                                            title: "\\bar{}" },
    { display: "tilde",   latex: "\\tilde{}",                                                          title: "\\tilde{}" },
    { display: "dot",     latex: "\\dot{}",                                                            title: "\\dot{}" },
    { display: "ddot",    latex: "\\ddot{}",                                                           title: "\\ddot{}" },
    { display: "bf",      latex: "\\mathbf{}",                                                         title: "\\mathbf{}" },
    { display: "it",      latex: "\\mathit{}",                                                         title: "\\mathit{}" },
    { display: "rm",      latex: "\\mathrm{}",                                                         title: "\\mathrm{}" },
    { display: "text",    latex: "\\text{}",                                                           title: "\\text{}" },
    { display: "(·)",     latex: "\\left( \\right)",                                                   title: "\\left( \\right)" },
    { display: "[·]",     latex: "\\left[ \\right]",                                                   title: "\\left[ \\right]" },
    { display: "{·}",     latex: "\\left\\{ \\right\\}",                                               title: "\\left\\{ \\right\\}" },
    { display: "|·|",     latex: "\\left| \\right|",                                                   title: "\\left| \\right|" },
    { display: "‖·‖",     latex: "\\left\\| \\right\\|",                                               title: "\\left\\| \\right\\|" },
    { display: "⌊·⌋",     latex: "\\left\\lfloor \\right\\rfloor",                                    title: "\\lfloor \\rfloor" },
    { display: "⌈·⌉",     latex: "\\left\\lceil \\right\\rceil",                                      title: "\\lceil \\rceil" },
    { display: "⟨·⟩",     latex: "\\langle  \\rangle",                                                title: "\\langle \\rangle" },
    { display: "mat",     latex: "\\begin{pmatrix}\n & \\\\\\\\ \n & \n\\end{pmatrix}",               title: "pmatrix 2x2" },
    { display: "bmat",    latex: "\\begin{bmatrix}\n & \\\\\\\\ \n & \n\\end{bmatrix}",               title: "bmatrix 2x2" },
    { display: "cases",   latex: "\\begin{cases}\n   & \\text{if } \\\\\\\\\n   & \\text{if }\n\\end{cases}", title: "cases" },
    { display: "align",   latex: "\\begin{align}\n  \n\\end{align}",                                  title: "align environment" },
  ],

  misc: [
    { display: "∞",  latex: "\\infty",           title: "\\infty" },
    { display: "∅",  latex: "\\emptyset",         title: "\\emptyset" },
    { display: "∀",  latex: "\\forall",           title: "\\forall" },
    { display: "∃",  latex: "\\exists",           title: "\\exists" },
    { display: "∄",  latex: "\\nexists",          title: "\\nexists" },
    { display: "¬",  latex: "\\lnot",             title: "\\lnot" },
    { display: "∴",  latex: "\\therefore",        title: "\\therefore" },
    { display: "∵",  latex: "\\because",          title: "\\because" },
    { display: "ℝ",  latex: "\\mathbb{R}",        title: "\\mathbb{R}" },
    { display: "ℤ",  latex: "\\mathbb{Z}",        title: "\\mathbb{Z}" },
    { display: "ℕ",  latex: "\\mathbb{N}",        title: "\\mathbb{N}" },
    { display: "ℚ",  latex: "\\mathbb{Q}",        title: "\\mathbb{Q}" },
    { display: "ℂ",  latex: "\\mathbb{C}",        title: "\\mathbb{C}" },
    { display: "ℵ",  latex: "\\aleph",            title: "\\aleph" },
    { display: "ℏ",  latex: "\\hbar",             title: "\\hbar" },
    { display: "…",  latex: "\\ldots",            title: "\\ldots" },
    { display: "⋯",  latex: "\\cdots",            title: "\\cdots" },
    { display: "⋮",  latex: "\\vdots",            title: "\\vdots" },
    { display: "⋱",  latex: "\\ddots",            title: "\\ddots" },
    { display: "°",  latex: "^{\\circ}",          title: "^{\\circ}" },
    { display: "′",  latex: "^{\\prime}",         title: "^{\\prime}" },
    { display: "″",  latex: "^{\\prime\\prime}",  title: "^{\\prime\\prime}" },
    { display: "†",  latex: "\\dagger",           title: "\\dagger" },
    { display: "‡",  latex: "\\ddagger",          title: "\\ddagger" },
    { display: "★",  latex: "\\star",             title: "\\star" },
    { display: "♯",  latex: "\\sharp",            title: "\\sharp" },
    { display: "♭",  latex: "\\flat",             title: "\\flat" },
    { display: "♮",  latex: "\\natural",          title: "\\natural" },
  ],
};

// ── Componente ────────────────────────────────────────────────────────────────

export function MathToolbarPanel({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const [activeCat, setActiveCat] = useState<Category>("greek");

  // Re-render when the tracked textarea changes (so the disable state updates)
  const [, forceUpdate] = useReducer((n: number) => n + 1, 0);
  useEffect(() => mathInsertManager.subscribe(forceUpdate), []);

  const hasTarget = mathInsertManager.hasTarget();

  return (
    <div
      className="editor-math-panel"
      style={{
        display: "flex",
        flexDirection: "column",
        borderLeft: "1px solid var(--border-firm)",
        background: "var(--bg-panel)",
        minHeight: 0,
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          padding: "8px 10px 8px 12px",
          borderBottom: "1px solid var(--border-subtle)",
          flexShrink: 0,
          gap: 6,
        }}
      >
        <IconSigma size={13} />
        <span
          style={{
            flex: 1,
            fontSize: "var(--fs-xs)",
            fontWeight: 600,
            color: "var(--fg-strong)",
            letterSpacing: "0.03em",
          }}
        >
          {t("math_toolbar.title")}
        </span>
        <button
          className="btn btn-ghost btn-icon"
          onClick={onClose}
          title={t("common.close")}
          style={{ padding: 4 }}
        >
          <IconX size={12} />
        </button>
      </div>

      {/* No-target hint */}
      {!hasTarget && (
        <div
          style={{
            padding: "8px 12px",
            fontSize: "var(--fs-xs)",
            color: "var(--fg-faint)",
            borderBottom: "1px solid var(--border-subtle)",
            lineHeight: 1.5,
          }}
        >
          {t("math_toolbar.hint_no_target")}
        </div>
      )}

      {/* Category tabs */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 2,
          padding: "6px 8px",
          borderBottom: "1px solid var(--border-subtle)",
          flexShrink: 0,
        }}
      >
        {CATEGORIES.map(({ id, labelKey }) => (
          <button
            key={id}
            className={`btn btn-sm ${activeCat === id ? "btn-accent" : "btn-ghost"}`}
            onClick={() => setActiveCat(id)}
            style={{ fontSize: 10, padding: "2px 7px" }}
          >
            {t(labelKey)}
          </button>
        ))}
      </div>

      {/* Symbol grid */}
      <div className="scroll" style={{ flex: 1, overflowY: "auto", padding: "8px" }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(36px, 1fr))",
            gap: 3,
          }}
        >
          {SYMBOLS[activeCat].map((sym, i) => (
            <button
              key={i}
              className="btn btn-ghost"
              title={sym.title ?? sym.latex}
              onClick={() => mathInsertManager.insert(sym.latex)}
              disabled={!hasTarget}
              style={{
                fontSize:
                  sym.display.length > 4
                    ? 8
                    : sym.display.length > 2
                      ? 9
                      : 14,
                fontFamily:
                  sym.display.length > 2
                    ? "var(--font-mono)"
                    : "Georgia, serif",
                padding: "4px 2px",
                minHeight: 32,
                minWidth: 32,
                lineHeight: 1,
                opacity: hasTarget ? 1 : 0.4,
                color: "var(--fg-body)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {sym.display}
            </button>
          ))}
        </div>

        <div
          style={{
            marginTop: 8,
            fontSize: 9,
            color: "var(--fg-faint)",
            textAlign: "center",
            padding: "4px 0",
            lineHeight: 1.4,
          }}
        >
          {t("math_toolbar.footer_hint")}
        </div>
      </div>
    </div>
  );
}
