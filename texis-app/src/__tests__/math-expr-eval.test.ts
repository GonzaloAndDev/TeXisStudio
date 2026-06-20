import { describe, it, expect } from "vitest";
import { compileExpr } from "../lib/mathExprEval";

describe("compileExpr — evaluador seguro para preview de gráficas", () => {
  const ev = (src: string, x: number) => {
    const f = compileExpr(src);
    expect(f, `no compiló: ${src}`).not.toBeNull();
    return f!(x);
  };

  it("aritmética y potencias", () => {
    expect(ev("x^2", 3)).toBe(9);
    expect(ev("2*x + 1", 4)).toBe(9);
    expect(ev("(x+1)*(x-1)", 3)).toBe(8);
    expect(ev("x^2 + 2*x + 1", 2)).toBe(9);
  });

  it("menos unario", () => {
    expect(ev("-x", 5)).toBe(-5);
    expect(ev("-(x^2)", 3)).toBe(-9);
    expect(ev("3 - -2", 0)).toBe(5);
  });

  it("trigonometría en GRADOS (como pgfplots)", () => {
    expect(ev("sin(90)", 0)).toBeCloseTo(1, 6);
    expect(ev("cos(0)", 0)).toBeCloseTo(1, 6);
    // sin(deg(x)) debe ser el seno clásico en radianes
    expect(ev("sin(deg(x))", Math.PI / 2)).toBeCloseTo(1, 6);
    expect(ev("cos(deg(x))", Math.PI)).toBeCloseTo(-1, 6);
  });

  it("funciones comunes", () => {
    expect(ev("exp(0)", 0)).toBeCloseTo(1, 6);
    expect(ev("sqrt(x)", 16)).toBe(4);
    expect(ev("abs(x)", -7)).toBe(7);
    expect(ev("ln(e)", 0)).toBeCloseTo(1, 6);
    // densidad normal
    expect(ev("exp(-x^2/2)/sqrt(2*pi)", 0)).toBeCloseTo(0.39894, 4);
  });

  it("constantes pi y e", () => {
    expect(ev("pi", 0)).toBeCloseTo(Math.PI, 6);
    expect(ev("e", 0)).toBeCloseTo(Math.E, 6);
  });

  it("rechaza entradas inválidas/inseguras (fallback null)", () => {
    expect(compileExpr("")).toBeNull();
    expect(compileExpr("foo(x)")).toBeNull();        // función desconocida
    expect(compileExpr("x +")).toBeNull();           // sintaxis incompleta
    expect(compileExpr("(x")).toBeNull();            // paréntesis sin cerrar
    expect(compileExpr("alert(1)")).toBeNull();      // no es eval: identificador desconocido
    expect(compileExpr("y^2")).toBeNull();           // variable desconocida (solo x)
  });
});
