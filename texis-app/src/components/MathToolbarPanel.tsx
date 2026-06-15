/**
 * MathToolbarPanel — panel lateral de símbolos y operadores matemáticos LaTeX.
 *
 * Se integra con mathInsertManager para insertar en la última textarea activa.
 * Todos los botones usan onMouseDown + preventDefault para evitar que se pierda
 * el foco de la textarea al hacer clic (patrón estándar de paletas de herramientas).
 */

import { useEffect, useReducer, useState } from "react";
import { useTranslation } from "react-i18next";
import { mathInsertManager } from "../lib/mathInsertManager";
import { IconX, IconSigma, IconChevronR, IconChevronL } from "./Icons";

// ── Tipos ─────────────────────────────────────────────────────────────────────

type Category = "greek" | "operators" | "relations" | "arrows" | "structures" | "misc";

interface MathSymbol {
  display: string;
  latex: string;
  title?: string;
}

// ── Datos ─────────────────────────────────────────────────────────────────────

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
    { display: "α",  latex: "\\alpha",      title: "\\alpha" },
    { display: "β",  latex: "\\beta",       title: "\\beta" },
    { display: "γ",  latex: "\\gamma",      title: "\\gamma" },
    { display: "δ",  latex: "\\delta",      title: "\\delta" },
    { display: "ε",  latex: "\\epsilon",    title: "\\epsilon" },
    { display: "ζ",  latex: "\\zeta",       title: "\\zeta" },
    { display: "η",  latex: "\\eta",        title: "\\eta" },
    { display: "θ",  latex: "\\theta",      title: "\\theta" },
    { display: "ι",  latex: "\\iota",       title: "\\iota" },
    { display: "κ",  latex: "\\kappa",      title: "\\kappa" },
    { display: "λ",  latex: "\\lambda",     title: "\\lambda" },
    { display: "μ",  latex: "\\mu",         title: "\\mu" },
    { display: "ν",  latex: "\\nu",         title: "\\nu" },
    { display: "ξ",  latex: "\\xi",         title: "\\xi" },
    { display: "π",  latex: "\\pi",         title: "\\pi" },
    { display: "ρ",  latex: "\\rho",        title: "\\rho" },
    { display: "σ",  latex: "\\sigma",      title: "\\sigma" },
    { display: "τ",  latex: "\\tau",        title: "\\tau" },
    { display: "υ",  latex: "\\upsilon",    title: "\\upsilon" },
    { display: "φ",  latex: "\\phi",        title: "\\phi" },
    { display: "χ",  latex: "\\chi",        title: "\\chi" },
    { display: "ψ",  latex: "\\psi",        title: "\\psi" },
    { display: "ω",  latex: "\\omega",      title: "\\omega" },
    { display: "ϑ",  latex: "\\vartheta",   title: "\\vartheta" },
    { display: "ϕ",  latex: "\\varphi",     title: "\\varphi" },
    { display: "ϵ",  latex: "\\varepsilon", title: "\\varepsilon" },
    { display: "Γ",  latex: "\\Gamma",      title: "\\Gamma" },
    { display: "Δ",  latex: "\\Delta",      title: "\\Delta" },
    { display: "Θ",  latex: "\\Theta",      title: "\\Theta" },
    { display: "Λ",  latex: "\\Lambda",     title: "\\Lambda" },
    { display: "Ξ",  latex: "\\Xi",         title: "\\Xi" },
    { display: "Π",  latex: "\\Pi",         title: "\\Pi" },
    { display: "Σ",  latex: "\\Sigma",      title: "\\Sigma" },
    { display: "Υ",  latex: "\\Upsilon",    title: "\\Upsilon" },
    { display: "Φ",  latex: "\\Phi",        title: "\\Phi" },
    { display: "Ψ",  latex: "\\Psi",        title: "\\Psi" },
    { display: "Ω",  latex: "\\Omega",      title: "\\Omega" },
  ],

  operators: [
    { display: "∑",   latex: "\\sum",      title: "\\sum" },
    { display: "∏",   latex: "\\prod",     title: "\\prod" },
    { display: "∫",   latex: "\\int",      title: "\\int" },
    { display: "∬",   latex: "\\iint",     title: "\\iint" },
    { display: "∭",   latex: "\\iiint",    title: "\\iiint" },
    { display: "∮",   latex: "\\oint",     title: "\\oint" },
    { display: "∂",   latex: "\\partial",  title: "\\partial" },
    { display: "∇",   latex: "\\nabla",    title: "\\nabla" },
    { display: "±",   latex: "\\pm",       title: "\\pm" },
    { display: "∓",   latex: "\\mp",       title: "\\mp" },
    { display: "×",   latex: "\\times",    title: "\\times" },
    { display: "÷",   latex: "\\div",      title: "\\div" },
    { display: "·",   latex: "\\cdot",     title: "\\cdot" },
    { display: "∘",   latex: "\\circ",     title: "\\circ" },
    { display: "⊕",   latex: "\\oplus",    title: "\\oplus" },
    { display: "⊗",   latex: "\\otimes",   title: "\\otimes" },
    { display: "lim", latex: "\\lim_{}",   title: "\\lim_{}" },
    { display: "max", latex: "\\max",      title: "\\max" },
    { display: "min", latex: "\\min",      title: "\\min" },
    { display: "sup", latex: "\\sup",      title: "\\sup" },
    { display: "inf", latex: "\\inf",      title: "\\inf" },
    { display: "log", latex: "\\log",      title: "\\log" },
    { display: "ln",  latex: "\\ln",       title: "\\ln" },
    { display: "exp", latex: "\\exp",      title: "\\exp" },
    { display: "sin", latex: "\\sin",      title: "\\sin" },
    { display: "cos", latex: "\\cos",      title: "\\cos" },
    { display: "tan", latex: "\\tan",      title: "\\tan" },
    { display: "det", latex: "\\det",      title: "\\det" },
    { display: "deg", latex: "\\deg",      title: "\\deg" },
  ],

  relations: [
    { display: "=",  latex: "=",           title: "=" },
    { display: "≠",  latex: "\\neq",       title: "\\neq" },
    { display: "<",  latex: "<",           title: "<" },
    { display: ">",  latex: ">",           title: ">" },
    { display: "≤",  latex: "\\leq",       title: "\\leq" },
    { display: "≥",  latex: "\\geq",       title: "\\geq" },
    { display: "≪",  latex: "\\ll",        title: "\\ll" },
    { display: "≫",  latex: "\\gg",        title: "\\gg" },
    { display: "≈",  latex: "\\approx",    title: "\\approx" },
    { display: "≡",  latex: "\\equiv",     title: "\\equiv" },
    { display: "∼",  latex: "\\sim",       title: "\\sim" },
    { display: "≃",  latex: "\\simeq",     title: "\\simeq" },
    { display: "∝",  latex: "\\propto",    title: "\\propto" },
    { display: "∈",  latex: "\\in",        title: "\\in" },
    { display: "∉",  latex: "\\notin",     title: "\\notin" },
    { display: "⊂",  latex: "\\subset",    title: "\\subset" },
    { display: "⊃",  latex: "\\supset",    title: "\\supset" },
    { display: "⊆",  latex: "\\subseteq",  title: "\\subseteq" },
    { display: "⊇",  latex: "\\supseteq",  title: "\\supseteq" },
    { display: "∪",  latex: "\\cup",       title: "\\cup" },
    { display: "∩",  latex: "\\cap",       title: "\\cap" },
    { display: "∧",  latex: "\\wedge",     title: "\\wedge" },
    { display: "∨",  latex: "\\vee",       title: "\\vee" },
    { display: "∥",  latex: "\\parallel",  title: "\\parallel" },
    { display: "⊥",  latex: "\\perp",      title: "\\perp" },
    { display: "⊢",  latex: "\\vdash",     title: "\\vdash" },
    { display: "⊨",  latex: "\\models",    title: "\\models" },
  ],

  arrows: [
    { display: "→",  latex: "\\to",                   title: "\\to" },
    { display: "←",  latex: "\\leftarrow",             title: "\\leftarrow" },
    { display: "↑",  latex: "\\uparrow",               title: "\\uparrow" },
    { display: "↓",  latex: "\\downarrow",             title: "\\downarrow" },
    { display: "↔",  latex: "\\leftrightarrow",        title: "\\leftrightarrow" },
    { display: "⇒",  latex: "\\Rightarrow",            title: "\\Rightarrow" },
    { display: "⇐",  latex: "\\Leftarrow",             title: "\\Leftarrow" },
    { display: "⇑",  latex: "\\Uparrow",               title: "\\Uparrow" },
    { display: "⇓",  latex: "\\Downarrow",             title: "\\Downarrow" },
    { display: "⇔",  latex: "\\Leftrightarrow",        title: "\\Leftrightarrow" },
    { display: "↦",  latex: "\\mapsto",                title: "\\mapsto" },
    { display: "⟶",  latex: "\\longrightarrow",        title: "\\longrightarrow" },
    { display: "⟵",  latex: "\\longleftarrow",         title: "\\longleftarrow" },
    { display: "⟹",  latex: "\\Longrightarrow",        title: "\\Longrightarrow" },
    { display: "⟸",  latex: "\\Longleftarrow",         title: "\\Longleftarrow" },
    { display: "⟺",  latex: "\\Longleftrightarrow",    title: "\\Longleftrightarrow" },
    { display: "↗",  latex: "\\nearrow",               title: "\\nearrow" },
    { display: "↘",  latex: "\\searrow",               title: "\\searrow" },
    { display: "↩",  latex: "\\hookleftarrow",         title: "\\hookleftarrow" },
    { display: "↪",  latex: "\\hookrightarrow",        title: "\\hookrightarrow" },
  ],

  structures: [
    { display: "a/b",   latex: "\\frac{}{}",                                                          title: "\\frac{num}{den}" },
    { display: "√·",    latex: "\\sqrt{}",                                                            title: "\\sqrt{}" },
    { display: "ⁿ√·",   latex: "\\sqrt[n]{}",                                                         title: "\\sqrt[n]{}" },
    { display: "xⁿ",    latex: "^{}",                                                                 title: "superíndice ^{}" },
    { display: "xₙ",    latex: "_{}",                                                                 title: "subíndice _{}" },
    { display: "x^n_m", latex: "^{}_{}",                                                              title: "sup + sub" },
    { display: "∑ᵢⁿ",   latex: "\\sum_{i=1}^{n}",                                                    title: "\\sum_{i=1}^{n}" },
    { display: "∏ᵢⁿ",   latex: "\\prod_{i=1}^{n}",                                                   title: "\\prod_{i=1}^{n}" },
    { display: "∫ₐᵇ",   latex: "\\int_{a}^{b}",                                                      title: "\\int_{a}^{b}" },
    { display: "lim→",  latex: "\\lim_{x \\to }",                                                     title: "\\lim_{x \\to }" },
    { display: "vec",   latex: "\\vec{}",                                                             title: "\\vec{}" },
    { display: "hat",   latex: "\\hat{}",                                                             title: "\\hat{}" },
    { display: "bar",   latex: "\\bar{}",                                                             title: "\\bar{}" },
    { display: "tilde", latex: "\\tilde{}",                                                           title: "\\tilde{}" },
    { display: "dot",   latex: "\\dot{}",                                                             title: "\\dot{}" },
    { display: "ddot",  latex: "\\ddot{}",                                                            title: "\\ddot{}" },
    { display: "bf",    latex: "\\mathbf{}",                                                          title: "\\mathbf{}" },
    { display: "it",    latex: "\\mathit{}",                                                          title: "\\mathit{}" },
    { display: "rm",    latex: "\\mathrm{}",                                                          title: "\\mathrm{}" },
    { display: "text",  latex: "\\text{}",                                                            title: "\\text{}" },
    { display: "(·)",   latex: "\\left( \\right)",                                                    title: "\\left( \\right)" },
    { display: "[·]",   latex: "\\left[ \\right]",                                                    title: "\\left[ \\right]" },
    { display: "{·}",   latex: "\\left\\{ \\right\\}",                                                title: "\\left\\{ \\right\\}" },
    { display: "|·|",   latex: "\\left| \\right|",                                                    title: "\\left| \\right|" },
    { display: "‖·‖",   latex: "\\left\\| \\right\\|",                                                title: "\\left\\| \\right\\|" },
    { display: "⌊·⌋",   latex: "\\left\\lfloor \\right\\rfloor",                                     title: "\\lfloor \\rfloor" },
    { display: "⌈·⌉",   latex: "\\left\\lceil \\right\\rceil",                                       title: "\\lceil \\rceil" },
    { display: "⟨·⟩",   latex: "\\langle  \\rangle",                                                 title: "\\langle \\rangle" },
    { display: "mat",   latex: "\\begin{pmatrix}\n & \\\\\\\\ \n & \n\\end{pmatrix}",                 title: "pmatrix 2×2" },
    { display: "bmat",  latex: "\\begin{bmatrix}\n & \\\\\\\\ \n & \n\\end{bmatrix}",                 title: "bmatrix 2×2" },
    { display: "cases", latex: "\\begin{cases}\n   & \\text{if } \\\\\\\\\n   & \\text{if }\n\\end{cases}", title: "cases" },
    { display: "align", latex: "\\begin{align}\n  \n\\end{align}",                                    title: "align" },
  ],

  misc: [
    { display: "∞",  latex: "\\infty",          title: "\\infty" },
    { display: "∅",  latex: "\\emptyset",        title: "\\emptyset" },
    { display: "∀",  latex: "\\forall",          title: "\\forall" },
    { display: "∃",  latex: "\\exists",          title: "\\exists" },
    { display: "∄",  latex: "\\nexists",         title: "\\nexists" },
    { display: "¬",  latex: "\\lnot",            title: "\\lnot" },
    { display: "∴",  latex: "\\therefore",       title: "\\therefore" },
    { display: "∵",  latex: "\\because",         title: "\\because" },
    { display: "ℝ",  latex: "\\mathbb{R}",       title: "\\mathbb{R}" },
    { display: "ℤ",  latex: "\\mathbb{Z}",       title: "\\mathbb{Z}" },
    { display: "ℕ",  latex: "\\mathbb{N}",       title: "\\mathbb{N}" },
    { display: "ℚ",  latex: "\\mathbb{Q}",       title: "\\mathbb{Q}" },
    { display: "ℂ",  latex: "\\mathbb{C}",       title: "\\mathbb{C}" },
    { display: "ℵ",  latex: "\\aleph",           title: "\\aleph" },
    { display: "ℏ",  latex: "\\hbar",            title: "\\hbar" },
    { display: "…",  latex: "\\ldots",           title: "\\ldots" },
    { display: "⋯",  latex: "\\cdots",           title: "\\cdots" },
    { display: "⋮",  latex: "\\vdots",           title: "\\vdots" },
    { display: "⋱",  latex: "\\ddots",           title: "\\ddots" },
    { display: "°",  latex: "^{\\circ}",         title: "^{\\circ}" },
    { display: "′",  latex: "^{\\prime}",        title: "^{\\prime}" },
    { display: "″",  latex: "^{\\prime\\prime}", title: "^{\\prime\\prime}" },
    { display: "†",  latex: "\\dagger",          title: "\\dagger" },
    { display: "‡",  latex: "\\ddagger",         title: "\\ddagger" },
    { display: "★",  latex: "\\star",            title: "\\star" },
    { display: "♯",  latex: "\\sharp",           title: "\\sharp" },
    { display: "♭",  latex: "\\flat",            title: "\\flat" },
    { display: "♮",  latex: "\\natural",         title: "\\natural" },
  ],
};

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Previene que el foco salga de la textarea activa cuando el usuario hace clic
 * en los botones del panel. Sin esto, el blur dispara ANTES de click, y
 * mathInsertManager.current queda null antes de que insert() se ejecute.
 */
const noBlur = (e: React.MouseEvent) => e.preventDefault();

// ── Componente ────────────────────────────────────────────────────────────────

export function MathToolbarPanel({ onClose, collapsed, onToggleCollapse }: { onClose: () => void; collapsed: boolean; onToggleCollapse: () => void }) {
  const { t } = useTranslation();
  const [activeCat, setActiveCat] = useState<Category>("greek");

  const [, forceUpdate] = useReducer((n: number) => n + 1, 0);
  useEffect(() => mathInsertManager.subscribe(forceUpdate), []);

  const hasTarget = mathInsertManager.hasTarget();
  const symbols = SYMBOLS[activeCat];

  if (collapsed) {
    return (
      <div
        className="editor-panel-rail editor-panel-rail-right"
        style={{ flexDirection: "column", alignItems: "center", gap: 4 }}
      >
        <button
          className="btn btn-ghost btn-icon"
          onMouseDown={noBlur}
          onClick={onToggleCollapse}
          title={t("math_toolbar.expand")}
          style={{ padding: 5 }}
        >
          <IconChevronL size={13} />
        </button>
        <IconSigma size={12} style={{ color: "var(--fg-muted)", marginTop: 4 }} />
        <span className="editor-rail-label">{t("math_toolbar.title")}</span>
        <button
          className="btn btn-ghost btn-icon"
          onMouseDown={noBlur}
          onClick={onClose}
          title={t("common.close")}
          style={{ padding: 4, marginTop: "auto", marginBottom: 8, color: "var(--fg-muted)" }}
        >
          <IconX size={11} />
        </button>
      </div>
    );
  }

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
      {/* ── Header ────────────────────────────────────────────────── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          padding: "9px 10px 9px 12px",
          borderBottom: "1px solid var(--border-subtle)",
          flexShrink: 0,
          gap: 7,
          background: "var(--bg-chrome)",
        }}
      >
        <IconSigma size={12} style={{ color: "var(--fg-muted)", flexShrink: 0 }} />
        <span
          style={{
            flex: 1,
            fontSize: "var(--fs-xs)",
            fontWeight: 600,
            color: "var(--fg-strong)",
            letterSpacing: "0.04em",
            textTransform: "uppercase",
          }}
        >
          {t("math_toolbar.title")}
        </span>
        <button
          className="btn btn-ghost btn-icon"
          onMouseDown={noBlur}
          onClick={onToggleCollapse}
          title={t("math_toolbar.collapse")}
          style={{ padding: 3, color: "var(--fg-muted)" }}
        >
          <IconChevronR size={11} />
        </button>
        <button
          className="btn btn-ghost btn-icon"
          onMouseDown={noBlur}
          onClick={onClose}
          title={t("common.close")}
          style={{ padding: 3, color: "var(--fg-muted)" }}
        >
          <IconX size={11} />
        </button>
      </div>

      {/* ── Estado: sin textarea activa ───────────────────────────── */}
      {!hasTarget && (
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: 8,
            padding: "10px 12px",
            margin: "8px",
            background: "var(--bg-app)",
            border: "1px solid var(--border-subtle)",
            borderRadius: "var(--r-sm)",
            flexShrink: 0,
          }}
        >
          <span style={{ fontSize: 14, lineHeight: 1, flexShrink: 0, marginTop: 1 }}>⌨</span>
          <p style={{ margin: 0, fontSize: "var(--fs-xs)", color: "var(--fg-muted)", lineHeight: 1.5 }}>
            {t("math_toolbar.hint_no_target")}
          </p>
        </div>
      )}

      {/* ── Pestañas de categoría ─────────────────────────────────── */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 3,
          padding: "8px 8px 6px",
          borderBottom: "1px solid var(--border-subtle)",
          flexShrink: 0,
        }}
      >
        {CATEGORIES.map(({ id, labelKey }) => (
          <button
            key={id}
            className={`btn btn-sm ${activeCat === id ? "btn-accent" : "btn-ghost"}`}
            onMouseDown={noBlur}
            onClick={() => setActiveCat(id)}
            style={{
              fontSize: 10,
              padding: "3px 8px",
              fontWeight: activeCat === id ? 600 : 400,
            }}
          >
            {t(labelKey)}
          </button>
        ))}
      </div>

      {/* ── Grid de símbolos ──────────────────────────────────────── */}
      <div className="scroll" style={{ flex: 1, overflowY: "auto", padding: "8px 6px 4px" }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(34px, 1fr))",
            gap: 2,
          }}
        >
          {symbols.map((sym, i) => {
            const isLong = sym.display.length > 4;
            const isMed  = !isLong && sym.display.length > 2;
            return (
              <button
                key={i}
                className="btn btn-ghost"
                title={sym.title ?? sym.latex}
                onMouseDown={noBlur}
                onClick={() => mathInsertManager.insert(sym.latex)}
                disabled={!hasTarget}
                style={{
                  fontSize: isLong ? 8 : isMed ? 9 : 15,
                  fontFamily: isMed || isLong ? "var(--font-mono)" : "Georgia, 'Times New Roman', serif",
                  padding: "3px 2px",
                  minHeight: 30,
                  minWidth: 30,
                  lineHeight: 1,
                  opacity: hasTarget ? 1 : 0.35,
                  color: hasTarget ? "var(--fg-body)" : "var(--fg-faint)",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  border: "1px solid transparent",
                  transition: "border-color 0.1s, background 0.1s",
                }}
              >
                {sym.display}
              </button>
            );
          })}
        </div>

        {/* Footer */}
        <div
          style={{
            marginTop: 10,
            paddingTop: 8,
            borderTop: "1px solid var(--border-subtle)",
            fontSize: 9,
            color: "var(--fg-faint)",
            textAlign: "center",
            lineHeight: 1.4,
            paddingBottom: 4,
          }}
        >
          {t("math_toolbar.footer_hint")}
        </div>
      </div>
    </div>
  );
}
