/**
 * Catálogo compartido de símbolos LaTeX para todos los editores matemáticos
 * (bloque inline en el documento + plugins de math-engine).
 *
 * Mantener aquí los datos crudos; cualquier UI que renderice la paleta importa
 * `SYMBOLS` y `CATEGORIES`. Los tooltips con lenguaje natural usan `titleKey`
 * (resuelto vía i18n por el consumidor); los puros LaTeX (`\alpha`, etc.) van
 * en `title` literal porque son verbatim y no se traducen.
 */

export type MathCategory = "greek" | "operators" | "relations" | "arrows" | "structures" | "misc";

export interface MathSymbol {
  display: string;
  latex: string;
  title?: string;
  titleKey?: string;
}

export const CATEGORIES: { id: MathCategory; labelKey: string }[] = [
  { id: "greek",      labelKey: "math_toolbar.cat_greek" },
  { id: "operators",  labelKey: "math_toolbar.cat_operators" },
  { id: "relations",  labelKey: "math_toolbar.cat_relations" },
  { id: "arrows",     labelKey: "math_toolbar.cat_arrows" },
  { id: "structures", labelKey: "math_toolbar.cat_structures" },
  { id: "misc",       labelKey: "math_toolbar.cat_misc" },
];

export const SYMBOLS: Record<MathCategory, MathSymbol[]> = {
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
    { display: "lim", latex: "\\lim_{} {}", titleKey: "math_toolbar.tip_lim" },
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
    { display: "ⁿ√·",   latex: "\\sqrt[]{}",                                                          titleKey: "math_toolbar.tip_sqrt_n" },
    { display: "xⁿ",    latex: "^{}",                                                                 titleKey: "math_toolbar.tip_superscript" },
    { display: "xₙ",    latex: "_{}",                                                                 titleKey: "math_toolbar.tip_subscript" },
    { display: "x^n_m", latex: "^{}_{}",                                                              titleKey: "math_toolbar.tip_sup_sub" },
    { display: "∑ᵢⁿ",   latex: "\\sum_{}^{}",                                                       titleKey: "math_toolbar.tip_sum_bounds" },
    { display: "∏ᵢⁿ",   latex: "\\prod_{}^{}",                                                      titleKey: "math_toolbar.tip_prod_bounds" },
    { display: "∫ₐᵇ",   latex: "\\int_{}^{}",                                                       titleKey: "math_toolbar.tip_int_bounds" },
    { display: "lim→",  latex: "\\lim_{} {}",                                                       titleKey: "math_toolbar.tip_lim" },
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
    { display: "mat",   latex: "\\begin{pmatrix}\n   & \\\\\n   & \n\\end{pmatrix}",                  titleKey: "math_toolbar.tip_pmatrix" },
    { display: "bmat",  latex: "\\begin{bmatrix}\n   & \\\\\n   & \n\\end{bmatrix}",                  titleKey: "math_toolbar.tip_bmatrix" },
    { display: "cases", latex: "\\begin{cases}\n   & \\text{if } \\\\\n   & \\text{if }\n\\end{cases}", titleKey: "math_toolbar.tip_cases" },
    { display: "align", latex: "\\begin{aligned}\n   &= \\\\\n   &=\n\\end{aligned}",                 titleKey: "math_toolbar.tip_aligned" },
    { display: "(n k)",  latex: "\\binom{}{}",                                                         titleKey: "math_toolbar.tip_binom" },
    { display: "dfrac",  latex: "\\dfrac{}{}",                                                         titleKey: "math_toolbar.tip_dfrac" },
    { display: "tfrac",  latex: "\\tfrac{}{}",                                                         titleKey: "math_toolbar.tip_tfrac" },
    { display: "stck",   latex: "\\stackrel{}{}",                                                      titleKey: "math_toolbar.tip_stackrel" },
    { display: "ovset",  latex: "\\overset{}{}",                                                       titleKey: "math_toolbar.tip_overset" },
    { display: "unset",  latex: "\\underset{}{}",                                                      titleKey: "math_toolbar.tip_underset" },
    { display: "ovbr",   latex: "\\overbrace{}^{}",                                                    titleKey: "math_toolbar.tip_overbrace" },
    { display: "unbr",   latex: "\\underbrace{}_{}",                                                   titleKey: "math_toolbar.tip_underbrace" },
    { display: "x→y",   latex: "\\xrightarrow[]{}",                                                   titleKey: "math_toolbar.tip_xrightarrow" },
    { display: "x←y",   latex: "\\xleftarrow[]{}",                                                    titleKey: "math_toolbar.tip_xleftarrow" },
    { display: "sbst",   latex: "\\substack{ \\\\ }",                                                  titleKey: "math_toolbar.tip_substack" },
    { display: "argmax", latex: "\\operatorname*{arg\\,max}_{} {}",                                    titleKey: "math_toolbar.tip_argmax" },
    { display: "argmin", latex: "\\operatorname*{arg\\,min}_{} {}",                                    titleKey: "math_toolbar.tip_argmin" },
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

// ── Metadata de slots por operador ────────────────────────────────────────────
//
// Para cada snippet multi-slot, describe qué espera cada `{}` en orden. Lo usa
// `SlotLegend` para mostrar al usuario "qué va en cada caja" cuando inserta un
// comando, sin tener que recordar la sintaxis. Las `nameKey` y `slotKeys`
// resuelven contra i18n (`math_ops.*`).
//
// Para snippets como `\sqrt[]{}` el primer slot corresponde a `[]` y el
// segundo a `{}`. SlotLegend solo necesita el orden — la detección de la
// posición exacta la hace el manager escaneando `{}` / `[]` vacíos en el
// fragmento insertado.

export interface OperatorMeta {
  nameKey: string;
  slotKeys: string[];
}

export const OPERATOR_SLOTS: Record<string, OperatorMeta> = {
  "\\frac{}{}":        { nameKey: "math_ops.frac",        slotKeys: ["math_ops.slot.numerator", "math_ops.slot.denominator"] },
  "\\dfrac{}{}":       { nameKey: "math_ops.dfrac",       slotKeys: ["math_ops.slot.numerator", "math_ops.slot.denominator"] },
  "\\tfrac{}{}":       { nameKey: "math_ops.tfrac",       slotKeys: ["math_ops.slot.numerator", "math_ops.slot.denominator"] },
  "\\binom{}{}":       { nameKey: "math_ops.binom",       slotKeys: ["math_ops.slot.n", "math_ops.slot.k"] },
  "\\sqrt[]{}":        { nameKey: "math_ops.sqrt_n",      slotKeys: ["math_ops.slot.index", "math_ops.slot.radicand"] },
  "^{}_{}":            { nameKey: "math_ops.sup_sub",     slotKeys: ["math_ops.slot.superscript", "math_ops.slot.subscript"] },
  "\\sum_{}^{}":       { nameKey: "math_ops.sum",         slotKeys: ["math_ops.slot.lower", "math_ops.slot.upper"] },
  "\\prod_{}^{}":      { nameKey: "math_ops.prod",        slotKeys: ["math_ops.slot.lower", "math_ops.slot.upper"] },
  "\\int_{}^{}":       { nameKey: "math_ops.int",         slotKeys: ["math_ops.slot.lower", "math_ops.slot.upper"] },
  "\\lim_{} {}":       { nameKey: "math_ops.lim",         slotKeys: ["math_ops.slot.lim_cond", "math_ops.slot.body"] },
  "\\stackrel{}{}":    { nameKey: "math_ops.stackrel",    slotKeys: ["math_ops.slot.above", "math_ops.slot.relation"] },
  "\\overset{}{}":     { nameKey: "math_ops.overset",     slotKeys: ["math_ops.slot.above", "math_ops.slot.base"] },
  "\\underset{}{}":    { nameKey: "math_ops.underset",    slotKeys: ["math_ops.slot.below", "math_ops.slot.base"] },
  "\\overbrace{}^{}":  { nameKey: "math_ops.overbrace",   slotKeys: ["math_ops.slot.expression", "math_ops.slot.label"] },
  "\\underbrace{}_{}": { nameKey: "math_ops.underbrace",  slotKeys: ["math_ops.slot.expression", "math_ops.slot.label"] },
  "\\xrightarrow[]{}": { nameKey: "math_ops.xrightarrow", slotKeys: ["math_ops.slot.below", "math_ops.slot.above"] },
  "\\xleftarrow[]{}":  { nameKey: "math_ops.xleftarrow",  slotKeys: ["math_ops.slot.below", "math_ops.slot.above"] },
  "\\operatorname*{arg\\,max}_{} {}": { nameKey: "math_ops.argmax", slotKeys: ["math_ops.slot.domain", "math_ops.slot.function"] },
  "\\operatorname*{arg\\,min}_{} {}": { nameKey: "math_ops.argmin", slotKeys: ["math_ops.slot.domain", "math_ops.slot.function"] },
};

/**
 * Devuelve los rangos absolutos `[start, end]` de cada slot dentro de un
 * fragmento de LaTeX recién insertado. Escanea `{}` y `[]` vacíos en orden
 * y los empareja con los slots declarados en `OPERATOR_SLOTS`. Si el snippet
 * tiene más slots que metadatos (o viceversa), se devuelve el mínimo.
 *
 * `offset` es la posición absoluta donde se insertó el fragmento en la
 * textarea (las posiciones devueltas ya están en coordenadas absolutas).
 */
export function computeSlotRanges(latex: string, offset: number): Array<{ start: number; end: number }> {
  const out: Array<{ start: number; end: number }> = [];
  for (let i = 0; i < latex.length - 1; i++) {
    const a = latex[i], b = latex[i + 1];
    if ((a === "{" && b === "}") || (a === "[" && b === "]")) {
      out.push({ start: offset + i + 1, end: offset + i + 1 });
      i++; // saltar el cierre
    }
  }
  return out;
}

