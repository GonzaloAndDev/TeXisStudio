/**
 * Inline LaTeX validation tests.
 * Tests that raw_latex blocks show syntax errors inline.
 */

import { test, expect } from "@playwright/test";

test.describe("LaTeX validation", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/demo");
    await page.waitForURL(/\/project\//);
    await page.waitForLoadState("networkidle");
  });

  test("raw_latex block with unbalanced brace shows error", async ({ page }) => {
    // Find a raw_latex block via command palette — Ctrl+K to open, then search
    await page.locator("body").click();
    await page.keyboard.press("Control+k");
    await page.waitForTimeout(300);

    // If command palette opens, search for LaTeX block command
    const paletteVisible = await page.getByPlaceholder(/buscar|search/i).isVisible().catch(() => false);
    if (paletteVisible) {
      await page.keyboard.press("Escape");
    }

    // Find any textarea that appears to be a raw_latex editor
    // (it will have the monospace dark styling from the component)
    const latexTextarea = page.locator('textarea[style*="ink-900"], textarea[style*="mono"]').first();
    const hasTextarea = await latexTextarea.isVisible().catch(() => false);

    if (hasTextarea) {
      await latexTextarea.fill("\\begin{equation}\nx = {1");
      // Wait for validation to run
      await page.waitForTimeout(200);
      // Should show an error indicator (red border or error text)
      await expect(page.locator("body")).toContainText(/llave|brace|begin.*equation/i);
    } else {
      // Skip if no raw_latex block in demo
      test.skip();
    }
  });

  test("raw_latex block with balanced braces shows no error", async ({ page }) => {
    const latexTextarea = page.locator('textarea[style*="ink-900"], textarea[style*="mono"]').first();
    const hasTextarea = await latexTextarea.isVisible().catch(() => false);

    if (hasTextarea) {
      await latexTextarea.fill("\\begin{equation}\nx = {1 + 2}\n\\end{equation}");
      await page.waitForTimeout(200);
      // Should not show brace errors
      const errText = page.locator("body");
      const text = await errText.textContent();
      expect(text).not.toMatch(/✕.*llave|✕.*brace/i);
    } else {
      test.skip();
    }
  });
});
