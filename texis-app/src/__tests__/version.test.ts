import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { APP_VERSION } from "../version";

const SEMVER_RE = /^\d+\.\d+\.\d+$/;

describe("APP_VERSION", () => {
  it("is a valid semver string", () => {
    expect(APP_VERSION).toMatch(SEMVER_RE);
  });

  it("matches package.json version", () => {
    const pkg = JSON.parse(readFileSync(join(__dirname, "../../package.json"), "utf-8")) as { version: string };
    expect(APP_VERSION).toBe(pkg.version);
  });

  it("matches tauri.conf.json version", () => {
    const conf = JSON.parse(readFileSync(join(__dirname, "../../src-tauri/tauri.conf.json"), "utf-8")) as { version: string };
    expect(APP_VERSION).toBe(conf.version);
  });
});
