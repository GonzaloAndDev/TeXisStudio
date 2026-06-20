/**
 * Evaluador de expresiones matemáticas SEGURO (sin eval/Function).
 * Soporta: + - * / ^, paréntesis, variable `x`, constantes pi/e, y funciones
 * comunes (sin, cos, tan, exp, ln, log, sqrt, abs, …). Pensado para PREVIEW de
 * gráficas function2d — no para compilar LaTeX. Si la expresión no se puede
 * parsear, `compileExpr` devuelve null y el llamador hace fallback.
 */

type Token = { t: "num"; v: number } | { t: "var" } | { t: "op"; v: string }
  | { t: "fn"; v: string } | { t: "lp" } | { t: "rp" };

// IMPORTANTE: pgfplots evalúa la trigonometría en GRADOS (no radianes), y usa
// deg()/rad() para convertir. Replicamos esa semántica para que el preview
// coincida con lo que produce pgfplots: p. ej. `sin(deg(x))` = sin(x) clásico.
const D2R = Math.PI / 180, R2D = 180 / Math.PI;
const FUNCS: Record<string, (x: number) => number> = {
  sin: (d) => Math.sin(d * D2R), cos: (d) => Math.cos(d * D2R), tan: (d) => Math.tan(d * D2R),
  asin: (v) => Math.asin(v) * R2D, acos: (v) => Math.acos(v) * R2D, atan: (v) => Math.atan(v) * R2D,
  sinh: Math.sinh, cosh: Math.cosh, tanh: Math.tanh,
  exp: Math.exp, sqrt: Math.sqrt, abs: Math.abs,
  ln: Math.log, log: Math.log10, log10: Math.log10, log2: Math.log2,
  floor: Math.floor, ceil: Math.ceil, round: Math.round, sign: Math.sign,
  deg: (r) => r * R2D, rad: (d) => d * D2R,
};
const CONSTS: Record<string, number> = { pi: Math.PI, e: Math.E };
// "u-" = menos unario. Precedencia entre * y ^ para que: -x^2 = -(x^2),
// -2*3 = (-2)*3, y 3 - -2 = 5.
const PREC: Record<string, number> = { "+": 1, "-": 1, "*": 2, "/": 2, "u-": 3, "^": 4 };
const RIGHT_ASSOC = new Set(["^", "u-"]);

function tokenize(src: string): Token[] | null {
  const s = src.replace(/\s+/g, "");
  const out: Token[] = [];
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (/[0-9.]/.test(c)) {
      let j = i + 1;
      while (j < s.length && /[0-9.eE+\-]/.test(s[j])) {
        // permitir notación científica 1e-3, pero no confundir + - binarios
        if ((s[j] === "+" || s[j] === "-") && !/[eE]/.test(s[j - 1])) break;
        j++;
      }
      const num = Number(s.slice(i, j));
      if (!Number.isFinite(num)) return null;
      out.push({ t: "num", v: num }); i = j; continue;
    }
    if (/[a-zA-Z]/.test(c)) {
      let j = i + 1;
      while (j < s.length && /[a-zA-Z0-9]/.test(s[j])) j++;
      const name = s.slice(i, j);
      if (name === "x") out.push({ t: "var" });
      else if (name in CONSTS) out.push({ t: "num", v: CONSTS[name] });
      else if (name in FUNCS) out.push({ t: "fn", v: name });
      else return null; // identificador desconocido
      i = j; continue;
    }
    if (c === "(") { out.push({ t: "lp" }); i++; continue; }
    if (c === ")") { out.push({ t: "rp" }); i++; continue; }
    if ("+-*/^".includes(c)) { out.push({ t: "op", v: c }); i++; continue; }
    return null; // carácter no soportado
  }
  return out;
}

/** Convierte a RPN (shunting-yard), manejando el menos unario como `0 -`. */
function toRpn(tokens: Token[]): Token[] | null {
  const out: Token[] = [];
  const stack: Token[] = [];
  let prev: Token | null = null;
  for (const tok of tokens) {
    if (tok.t === "num" || tok.t === "var") {
      out.push(tok);
    } else if (tok.t === "fn") {
      stack.push(tok);
    } else if (tok.t === "op") {
      // menos/más unario: al inicio o tras otro operador o "("
      const unary = (tok.v === "-" || tok.v === "+")
        && (prev === null || prev.t === "op" || prev.t === "lp");
      if (unary && tok.v === "+") { prev = tok; continue; } // +x ≡ x
      const cur: Token = unary ? { t: "op", v: "u-" } : tok;
      while (stack.length) {
        const top = stack[stack.length - 1];
        if (top.t === "fn") { out.push(stack.pop()!); continue; }
        if (top.t === "op") {
          const higher = PREC[top.v] > PREC[cur.v]
            || (PREC[top.v] === PREC[cur.v] && !RIGHT_ASSOC.has(cur.v));
          if (higher) { out.push(stack.pop()!); continue; }
        }
        break;
      }
      stack.push(cur);
    } else if (tok.t === "lp") {
      stack.push(tok);
    } else if (tok.t === "rp") {
      let found = false;
      while (stack.length) {
        const top = stack.pop()!;
        if (top.t === "lp") { found = true; break; }
        out.push(top);
      }
      if (!found) return null;
      if (stack.length && stack[stack.length - 1].t === "fn") out.push(stack.pop()!);
    }
    prev = tok;
  }
  while (stack.length) {
    const top = stack.pop()!;
    if (top.t === "lp" || top.t === "rp") return null;
    out.push(top);
  }
  return out;
}

function evalRpn(rpn: Token[], x: number): number | null {
  const st: number[] = [];
  for (const tok of rpn) {
    if (tok.t === "num") st.push(tok.v);
    else if (tok.t === "var") st.push(x);
    else if (tok.t === "fn") {
      const a = st.pop(); if (a === undefined) return null;
      st.push(FUNCS[tok.v](a));
    } else if (tok.t === "op" && tok.v === "u-") {
      const a = st.pop(); if (a === undefined) return null;
      st.push(-a);
    } else if (tok.t === "op") {
      const b = st.pop(); const a = st.pop();
      if (a === undefined || b === undefined) return null;
      switch (tok.v) {
        case "+": st.push(a + b); break;
        case "-": st.push(a - b); break;
        case "*": st.push(a * b); break;
        case "/": st.push(a / b); break;
        case "^": st.push(Math.pow(a, b)); break;
        default: return null;
      }
    }
  }
  return st.length === 1 ? st[0] : null;
}

/**
 * Compila una expresión en `x` a una función `(x) => number`. Devuelve null si
 * no se puede parsear (el preview hará fallback). Acepta sintaxis tipo pgfplots
 * básica; convierte `**` a `^`.
 */
export function compileExpr(src: string): ((x: number) => number) | null {
  if (!src || !src.trim()) return null;
  const normalized = src.replace(/\*\*/g, "^");
  const tokens = tokenize(normalized);
  if (!tokens) return null;
  const rpn = toRpn(tokens);
  if (!rpn) return null;
  // Validar con una evaluación de prueba.
  const test = evalRpn(rpn, 1);
  if (test === null) return null;
  return (x: number) => {
    const v = evalRpn(rpn, x);
    return v === null ? NaN : v;
  };
}
