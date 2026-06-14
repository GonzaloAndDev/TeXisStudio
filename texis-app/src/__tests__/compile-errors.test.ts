import { describe, expect, it } from "vitest";
import { isCancellationError } from "../lib/compileErrors";

describe("isCancellationError", () => {
  it("detects English cancellation phrasing", () => {
    expect(isCancellationError("Error: operation cancelled")).toBe(true);
    expect(isCancellationError("compile was canceled by user")).toBe(true);
  });

  it("detects Spanish cancellation phrasing", () => {
    expect(isCancellationError("Compilación cancelada por el usuario")).toBe(true);
    expect(isCancellationError(new Error("Proceso cancelado"))).toBe(true);
  });

  it("detects abort-style errors", () => {
    expect(isCancellationError(new DOMException("aborted", "AbortError"))).toBe(true);
    expect(isCancellationError("Process aborted")).toBe(true);
    expect(isCancellationError("the request was abort")).toBe(true);
  });

  it("returns false for genuine compile errors", () => {
    expect(isCancellationError("LaTeX Error: File `foo.sty' not found")).toBe(false);
    expect(isCancellationError("Undefined control sequence")).toBe(false);
    expect(isCancellationError(new Error("Missing $ inserted"))).toBe(false);
  });

  it("returns false for null/undefined/empty", () => {
    expect(isCancellationError(null)).toBe(false);
    expect(isCancellationError(undefined)).toBe(false);
    expect(isCancellationError("")).toBe(false);
  });
});
