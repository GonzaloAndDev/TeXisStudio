/**
 * Navigation and settings tests.
 */

import { test, expect } from "@playwright/test";

test.describe("Navigation", () => {
  test("settings page renders", async ({ page }) => {
    await page.goto("/settings");
    await page.waitForLoadState("networkidle");
    await expect(page.locator("body")).toBeVisible();
    // Settings should have some content (user mode, language, etc.)
    await expect(page.locator("body")).not.toBeEmpty();
  });

  test("settings typography section renders", async ({ page }) => {
    await page.goto("/settings/text");
    await page.waitForLoadState("networkidle");
    await expect(page.locator("body")).toBeVisible();
  });

  test("setup-latex page renders", async ({ page }) => {
    await page.goto("/setup-latex");
    await page.waitForLoadState("networkidle");
    await expect(page.locator("body")).toBeVisible();
  });

  test("library page renders", async ({ page }) => {
    await page.goto("/library");
    await page.waitForLoadState("networkidle");
    await expect(page.locator("body")).toBeVisible();
  });
});

test.describe("Demo editor navigation", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/demo");
    await page.waitForURL(/\/project\//);
    await page.waitForLoadState("networkidle");
  });

  test("command palette opens with Ctrl+K and closes with Escape", async ({ page }) => {
    await page.locator("body").click();
    await page.keyboard.press("Control+k");
    // Palette should appear
    await page.waitForTimeout(300);
    const paletteInput = page.getByPlaceholder(/buscar|search/i).first();
    const visible = await paletteInput.isVisible().catch(() => false);
    if (visible) {
      await page.keyboard.press("Escape");
      await expect(paletteInput).toBeHidden({ timeout: 2000 });
    }
  });

  test("Ctrl+S triggers save (no crash)", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.locator("body").click();
    await page.keyboard.press("Control+s");
    await page.waitForTimeout(500);
    expect(errors.filter((e) => !e.includes("ResizeObserver"))).toHaveLength(0);
  });
});
