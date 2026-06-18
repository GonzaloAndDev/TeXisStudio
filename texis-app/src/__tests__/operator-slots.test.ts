import { describe, it, expect } from "vitest";
import { OPERATOR_SLOTS, computeSlotRanges } from "../lib/mathSymbols";

describe("OPERATOR_SLOTS catalog", () => {
  it("declares 2 slots for every multi-arg snippet that has 2 empty {}", () => {
    // Spot-check the high-value entries.
    expect(OPERATOR_SLOTS["\\frac{}{}"].slotKeys.length).toBe(2);
    expect(OPERATOR_SLOTS["\\binom{}{}"].slotKeys.length).toBe(2);
    expect(OPERATOR_SLOTS["\\sum_{}^{}"].slotKeys.length).toBe(2);
    expect(OPERATOR_SLOTS["\\int_{}^{}"].slotKeys.length).toBe(2);
    expect(OPERATOR_SLOTS["\\lim_{} {}"].slotKeys.length).toBe(2);
  });

  it("names slots via i18n keys (no raw strings)", () => {
    for (const meta of Object.values(OPERATOR_SLOTS)) {
      expect(meta.nameKey).toMatch(/^math_ops\./);
      for (const k of meta.slotKeys) {
        expect(k).toMatch(/^math_ops\.slot\./);
      }
    }
  });

  it("covers sqrt[]{} as a 2-slot operator (index + radicand)", () => {
    const meta = OPERATOR_SLOTS["\\sqrt[]{}"];
    expect(meta).toBeDefined();
    expect(meta.slotKeys).toEqual(["math_ops.slot.index", "math_ops.slot.radicand"]);
  });
});

describe("computeSlotRanges", () => {
  it("finds the two {} positions in \\frac{}{}", () => {
    const ranges = computeSlotRanges("\\frac{}{}", 100);
    expect(ranges.length).toBe(2);
    // "\\frac{}{}": '\\','f','r','a','c','{','}','{','}'
    //  indices:       0   1   2   3   4   5   6   7   8
    // First empty {} is at 5–6, second at 7–8.
    // Cursor lands at index+1 of the opener — i.e. inside the `{}`.
    expect(ranges[0].start).toBe(100 + 6);
    expect(ranges[1].start).toBe(100 + 8);
  });

  it("treats \\sqrt[]{} as two slots ([] index, {} radicand) in order", () => {
    const ranges = computeSlotRanges("\\sqrt[]{}", 0);
    expect(ranges.length).toBe(2);
    // "\\sqrt[]{}" runtime length 9 — chars: \(0) s(1) q(2) r(3) t(4)
    // [(5) ](6) {(7) }(8). Cursor lands AFTER the opener, so 6 and 8.
    expect(ranges[0].start).toBe(6);
    expect(ranges[1].start).toBe(8);
  });

  it("returns 0 ranges when there are no empty slots", () => {
    expect(computeSlotRanges("\\alpha", 0)).toEqual([]);
    expect(computeSlotRanges("\\sum", 0)).toEqual([]);
  });

  it("offsets are absolute (cursor coordinates)", () => {
    const ranges = computeSlotRanges("a{}b", 500);
    expect(ranges.length).toBe(1);
    expect(ranges[0].start).toBe(502); // 500 + 1 (after the '{' at relative index 1) + ... = 500 + 2
  });
});
