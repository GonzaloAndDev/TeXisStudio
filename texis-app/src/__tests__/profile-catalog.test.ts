// Validates that bundled profile manifests have the required fields
// and that their section IDs don't collide within a profile.

import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, existsSync } from "fs";
import { join } from "path";

const PROFILES_ROOT = "/Users/gaelsd/Development/Others/TeXisStudio/TeXisStudio-Profiles";

// ── Helpers ──────────────────────────────────────────────────────────────────

function parseYamlId(content: string): string | null {
  const match = content.match(/^id:\s*["']?(.+?)["']?\s*$/m);
  return match ? match[1].trim() : null;
}

function parseYamlSections(content: string): string[] {
  const ids: string[] = [];
  const re = /^\s+-\s+id:\s*["']?(\S+?)["']?\s*$/gm;
  let m;
  while ((m = re.exec(content)) !== null) ids.push(m[1]);
  return ids;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("TeXisStudio-Profiles repository", () => {
  if (!existsSync(PROFILES_ROOT)) {
    it.skip("profiles root not found — skipping (run from monorepo root)", () => {});
    return;
  }

  function findProfileYamls(dir: string): string[] {
    const results: string[] = [];
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) results.push(...findProfileYamls(full));
      else if (entry.name === "profile.yaml") results.push(full);
    }
    return results;
  }

  const yamls = findProfileYamls(PROFILES_ROOT).filter(
    (p) => !p.includes("/samples/") && !p.includes("/node_modules/"),
  );

  it("finds at least 20 profile YAML files", () => {
    expect(yamls.length).toBeGreaterThanOrEqual(20);
  });

  for (const yamlPath of yamls) {
    const shortPath = yamlPath.replace(PROFILES_ROOT + "/", "");
    const content = readFileSync(yamlPath, "utf-8");

    it(`${shortPath}: has a non-empty id`, () => {
      const id = parseYamlId(content);
      expect(id).toBeTruthy();
      expect(id!.length).toBeGreaterThan(0);
    });

    it(`${shortPath}: sections have unique ids`, () => {
      const ids = parseYamlSections(content);
      const seen = new Set<string>();
      const dupes: string[] = [];
      for (const id of ids) {
        if (seen.has(id)) dupes.push(id);
        seen.add(id);
      }
      expect(dupes, `Duplicate section ids: ${dupes.join(", ")}`).toEqual([]);
    });
  }
});

describe("i18n locale files (TeXisStudio-Profiles)", () => {
  if (!existsSync(PROFILES_ROOT)) {
    it.skip("profiles root not found", () => {});
    return;
  }

  const i18nDir = join(PROFILES_ROOT, "i18n");

  it("en.json and es.json have the same number of profiles", () => {
    const en = JSON.parse(readFileSync(join(i18nDir, "en.json"), "utf-8"));
    const es = JSON.parse(readFileSync(join(i18nDir, "es.json"), "utf-8"));
    const enIds = Object.keys(en.profiles ?? {});
    const esIds = Object.keys(es.profiles ?? {});
    expect(enIds.length, "en.json profile count").toBe(esIds.length);
  });

  it("en.json has at least 50 profiles", () => {
    const en = JSON.parse(readFileSync(join(i18nDir, "en.json"), "utf-8"));
    expect(Object.keys(en.profiles ?? {}).length).toBeGreaterThanOrEqual(50);
  });
});
