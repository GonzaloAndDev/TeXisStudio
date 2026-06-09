// The updater is intentionally disabled until a signing key is provisioned.
// These tests verify the contract is met: no crash, no false "update available".

import { describe, it, expect } from "vitest";
import { checkForUpdate } from "../services/updater";

describe("checkForUpdate", () => {
  it("resolves without throwing", async () => {
    await expect(checkForUpdate()).resolves.toBeDefined();
  });

  it("returns available: false when updater is disabled", async () => {
    const result = await checkForUpdate();
    expect(result.available).toBe(false);
  });

  it("never returns available: true without a configured server", async () => {
    const result = await checkForUpdate();
    expect(result.available).not.toBe(true);
  });
});
