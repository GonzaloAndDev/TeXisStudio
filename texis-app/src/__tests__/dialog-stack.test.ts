import { afterEach, describe, expect, it } from "vitest";
import {
  _resetDialogStackForTests,
  isTopmostDialog,
  popDialog,
  pushDialog,
} from "../lib/dialogStack";

describe("dialogStack", () => {
  afterEach(() => _resetDialogStackForTests());

  it("topmost is the most recently pushed dialog", () => {
    const a = pushDialog();
    expect(isTopmostDialog(a)).toBe(true);

    const b = pushDialog();
    expect(isTopmostDialog(b)).toBe(true);
    expect(isTopmostDialog(a)).toBe(false);
  });

  it("popping the topmost restores the previous one", () => {
    const a = pushDialog();
    const b = pushDialog();
    popDialog(b);
    expect(isTopmostDialog(a)).toBe(true);
  });

  it("popping a non-topmost dialog does not change topmost", () => {
    const a = pushDialog();
    const b = pushDialog();
    popDialog(a);
    expect(isTopmostDialog(b)).toBe(true);
  });

  it("pop is idempotent", () => {
    const a = pushDialog();
    popDialog(a);
    popDialog(a); // no-op
    expect(isTopmostDialog(a)).toBe(false);
  });

  it("isTopmostDialog returns false on empty stack", () => {
    expect(isTopmostDialog("anything")).toBe(false);
  });

  it("ids do not collide across pushes", () => {
    const a = pushDialog();
    const b = pushDialog();
    const c = pushDialog();
    expect(new Set([a, b, c]).size).toBe(3);
  });
});
