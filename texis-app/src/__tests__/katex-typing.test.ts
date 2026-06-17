/**
 * Headless audit of the equation block's live-render claim. Simulates a user
 * typing math LaTeX one character at a time and measures the per-keystroke
 * render cost. If KaTeX can't keep up, the "real-time preview" promise breaks
 * — so this test fails loudly.
 *
 * Budget: 16ms/keystroke (one frame at 60fps). Slack to 25ms for CI variance.
 *
 * What this test does NOT prove:
 *  - That React schedules the re-render correctly (no DOM here).
 *  - That focus survives across re-renders.
 *  - That the math panel registration stays intact.
 * It only proves that KaTeX itself is fast enough; the rest is audited by
 * reading the code.
 */

import { describe, it, expect } from "vitest";
import katex from "katex";

function renderOrThrow(latex: string) {
  // The component uses throwOnError:true and falls back to an error UI.
  // Either branch is fine — we just need to know the cost.
  try {
    return katex.renderToString(latex, { displayMode: true, throwOnError: true, output: "html" });
  } catch (e) {
    return `ERR:${(e as Error).message.length}`;
  }
}

function typingBudget(text: string, label: string) {
  // Warm-up so KaTeX caches its style tables before we measure.
  renderOrThrow("x");

  let max = 0;
  let total = 0;
  let n = 0;
  for (let i = 1; i <= text.length; i++) {
    const prefix = text.slice(0, i);
    const start = performance.now();
    renderOrThrow(prefix);
    const dt = performance.now() - start;
    max = Math.max(max, dt);
    total += dt;
    n++;
  }
  const avg = total / n;
  // eslint-disable-next-line no-console
  console.log(`[${label}] n=${n} avg=${avg.toFixed(2)}ms max=${max.toFixed(2)}ms`);
  return { max, avg, n };
}

describe("KaTeX keystroke budget — equation block can render in real time", () => {
  it("renders a simple expression within the per-keystroke budget", () => {
    const { max } = typingBudget("E = mc^2", "E = mc^2");
    expect(max).toBeLessThan(25);
  });

  it("renders a fraction-with-limit within budget", () => {
    const expr = "f'(x) = \\lim_{h \\to 0} \\frac{f(x+h) - f(x)}{h}";
    const { max } = typingBudget(expr, "derivative");
    expect(max).toBeLessThan(25);
  });

  it("renders a 2x2 pmatrix within budget", () => {
    const expr = "A = \\begin{pmatrix} 1 & 2 \\\\ 3 & 4 \\end{pmatrix}";
    const { max } = typingBudget(expr, "matrix");
    expect(max).toBeLessThan(25);
  });

  it("renders a cases environment within budget", () => {
    const expr = "f(x) = \\begin{cases} 1 & x \\geq 0 \\\\ 0 & x < 0 \\end{cases}";
    const { max } = typingBudget(expr, "cases");
    expect(max).toBeLessThan(25);
  });

  it("renders aligned-inside-equation within budget", () => {
    const expr = "\\begin{aligned} (a+b)^2 &= a^2 + 2ab + b^2 \\\\ (a-b)^2 &= a^2 - 2ab + b^2 \\end{aligned}";
    const { max } = typingBudget(expr, "aligned");
    expect(max).toBeLessThan(25);
  });

  it("transient parse errors during typing don't blow up the budget", () => {
    // A user typing `\frac` — every intermediate state up to `\frac{a}{b}`
    // is an invalid expression. Make sure throwOnError + catch is cheap.
    const expr = "\\frac{a+b}{c-d}";
    const { max } = typingBudget(expr, "with-transient-errors");
    expect(max).toBeLessThan(25);
  });

  it("repeated keystrokes are not worse than first render (no leaks)", () => {
    const expr = "\\int_0^1 \\sqrt{1 - x^2} \\, dx";
    const first = typingBudget(expr, "int run 1");
    const second = typingBudget(expr, "int run 2");
    // Allow some variance but the second run must not be much slower.
    expect(second.avg).toBeLessThan(first.avg * 2 + 1);
  });
});
