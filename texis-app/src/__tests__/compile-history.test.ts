import { describe, expect, it, beforeEach } from "vitest";
import { loadCompileHistory, recordCompileHistory } from "../services/compileHistory";

describe("compile history", () => {
  const store = new Map<string, string>();

  beforeEach(() => {
    store.clear();
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: {
        localStorage: {
          getItem: (key: string) => store.get(key) ?? null,
          setItem: (key: string, value: string) => store.set(key, value),
        },
      },
    });
  });

  it("records newest checks first and filters by project", () => {
    recordCompileHistory({
      projectPath: "/tmp/a",
      success: true,
      qualityScore: 92,
      finalGatePassed: true,
      createdAt: "2026-01-01T00:00:00.000Z",
      id: "a",
    });
    recordCompileHistory({
      projectPath: "/tmp/b",
      success: false,
      errorCodes: ["LATEX_COMPILE_ERROR"],
      createdAt: "2026-01-02T00:00:00.000Z",
      id: "b",
    });

    expect(loadCompileHistory()).toHaveLength(2);
    expect(loadCompileHistory()[0].id).toBe("b");
    expect(loadCompileHistory("/tmp/a")).toEqual([
      expect.objectContaining({ id: "a", qualityScore: 92 }),
    ]);
  });
});
