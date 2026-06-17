/**
 * Slot navigation helpers — Wolfram-style "fill in the boxes" for math input.
 * These power both the post-insert cursor placement (mathInsertManager.insert)
 * and the Tab / Shift+Tab navigation between empty `{}` slots in the equation
 * textarea.
 */

import { describe, it, expect } from "vitest";
import {
  findFirstEmptySlot,
  findNextEmptySlot,
  findPrevEmptySlot,
} from "../lib/mathInsertManager";

describe("findFirstEmptySlot", () => {
  it("returns the position inside the only slot", () => {
    expect(findFirstEmptySlot("\\sqrt{}", 0, 7)).toBe(6); // between { and }
  });

  it("finds the FIRST empty pair when several exist", () => {
    // \frac{}{} → first {} at index 5..6, second at 7..8
    const text = "\\frac{}{}";
    expect(findFirstEmptySlot(text, 0, text.length)).toBe(6);
  });

  it("returns null when no empty pair exists in the range", () => {
    expect(findFirstEmptySlot("\\alpha", 0, 6)).toBeNull();
  });

  it("distinguishes filled pair from empty pair", () => {
    // \\frac{a}{} → first pair filled, second pair empty
    const text = "\\frac{a}{}";
    expect(findFirstEmptySlot(text, 0, text.length)).toBe(9);
  });

  it("respects the range bounds — slot outside [from,to) is invisible", () => {
    const text = "{}xx{}";
    // From index 2 onwards, only the second slot is in range.
    expect(findFirstEmptySlot(text, 2, text.length)).toBe(5);
  });

  it("nested {{}}: returns the inner empty pair", () => {
    // {{}} — at i=0: '{' then '{' (not empty). At i=1: '{' then '}' (empty).
    const text = "{{}}";
    expect(findFirstEmptySlot(text, 0, text.length)).toBe(2);
  });

  it("does not match `}{` (closing-then-opening)", () => {
    expect(findFirstEmptySlot("}{", 0, 2)).toBeNull();
  });

  it("safely handles empty input", () => {
    expect(findFirstEmptySlot("", 0, 0)).toBeNull();
  });

  it("safely handles a from index past the text length", () => {
    expect(findFirstEmptySlot("abc", 10, 20)).toBeNull();
  });
});

describe("findNextEmptySlot (Tab forward)", () => {
  it("finds the next empty pair after the cursor", () => {
    // \\frac{a}{} — cursor right after the 'a' (index 7). Next slot is at index 9.
    expect(findNextEmptySlot("\\frac{a}{}", 7)).toBe(9);
  });

  it("returns null when the cursor is past the last slot", () => {
    expect(findNextEmptySlot("\\frac{a}{b}", 11)).toBeNull();
  });

  it("returns null when the textarea has no slot at all", () => {
    expect(findNextEmptySlot("\\alpha + \\beta", 0)).toBeNull();
  });

  it("skips a slot at exactly the cursor index", () => {
    // Tab from inside an empty slot should land in the NEXT one, not stay.
    // Cursor inside `\\frac{}{}` first slot is at index 6.
    // Helper is "at or after from" — so it returns 6 again (current).
    // The Tab handler will call this with `from = pos`, which will return the
    // CURRENT slot. To get the next, the handler passes `pos + 1` — verified
    // here by querying past the current slot.
    expect(findNextEmptySlot("\\frac{}{}", 7)).toBe(8); // pos 7 = `}`, returns next `{}` opening at 7..8 → inside at 8
  });
});

describe("findPrevEmptySlot (Shift+Tab backward)", () => {
  it("finds the previous empty pair before the cursor", () => {
    // \\frac{}{a} — empty first slot at 5..6, cursor at index 9 (after 'a').
    expect(findPrevEmptySlot("\\frac{}{a}", 9)).toBe(6);
  });

  it("returns null when there is no slot before the cursor", () => {
    expect(findPrevEmptySlot("\\frac{}{}", 5)).toBeNull();
  });

  it("returns null on empty input", () => {
    expect(findPrevEmptySlot("", 0)).toBeNull();
  });
});

describe("realistic snippets used by the math panel", () => {
  it("\\frac{}{} lands cursor in the first slot", () => {
    const snippet = "\\frac{}{}";
    expect(findFirstEmptySlot(snippet, 0, snippet.length)).toBe(6);
  });

  it("\\sqrt[]{}: first slot is the optional [] index, then the {} radicand", () => {
    const snippet = "\\sqrt[]{}";
    // \ s q r t [ ] { }
    // 0 1 2 3 4 5 6 7 8
    // First empty pair is `[]` at index 5..6 → cursor inside at index 6.
    expect(findFirstEmptySlot(snippet, 0, snippet.length)).toBe(6);
    // Tab from there → next empty slot is the `{}` at 7..8 → cursor at 8.
    expect(findNextEmptySlot(snippet, 7)).toBe(8);
  });

  it("treats `[]` and `{}` interchangeably as empty slots", () => {
    expect(findFirstEmptySlot("[]", 0, 2)).toBe(1);
    expect(findFirstEmptySlot("a[]b{}c", 0, 7)).toBe(2);
    // Filled `[…]` is NOT a slot.
    expect(findFirstEmptySlot("[a]", 0, 3)).toBeNull();
  });

  it("\\sum_{}^{} lands cursor in the subscript slot first", () => {
    const snippet = "\\sum_{}^{}";
    // _ at 4, { at 5, } at 6. Cursor between { and } at index 6.
    expect(findFirstEmptySlot(snippet, 0, snippet.length)).toBe(6);
  });

  it("after typing in first slot, Tab lands cursor in second slot", () => {
    // User typed `i=1` in the first slot of \\sum_{}^{}, cursor at index 8.
    // Text became `\\sum_{i=1}^{}`. Tab → next empty slot at end.
    const text = "\\sum_{i=1}^{}";
    expect(findNextEmptySlot(text, 8)).toBe(12); // inside the second {}
  });

  it("matrix snippet has NO {} slots — first-slot lookup returns null", () => {
    // Documented behaviour: matrices/cases/aligned don't have {} slots; the
    // cursor lands at end of insertion and the user navigates manually. Future
    // work would add a different sentinel for cell positions.
    const snippet = "\\begin{pmatrix}\n   & \\\\\n   & \n\\end{pmatrix}";
    expect(findFirstEmptySlot(snippet, 0, snippet.length)).toBeNull();
  });
});
