/**
 * Editor flow tests — demo mode editor interactions.
 */

import { test, expect } from "@playwright/test";

test.describe("Editor", () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to demo project (works in browser mode)
    await page.goto("/demo");
    await page.waitForURL(/\/project\//);
    // Wait for the editor to be rendered
    await page.waitForLoadState("networkidle");
  });

  test("section tree is visible and has items", async ({ page }) => {
    // The section tree sidebar should show section groups
    const tree = page.locator(".section-tree-row").first();
    await expect(tree).toBeVisible({ timeout: 5000 });
  });

  test("clicking a section changes the active section", async ({ page }) => {
    const rows = page.locator(".section-tree-row");
    const count = await rows.count();
    expect(count).toBeGreaterThan(0);

    // Click the second row (if it exists and is not the already active one)
    if (count > 1) {
      await rows.nth(1).click();
      // After click, the row should be active (aria-selected=true)
      await expect(rows.nth(1).locator("[aria-selected='true']")).toBeVisible({ timeout: 3000 });
    }
  });

  test("citation picker opens with Ctrl+[", async ({ page }) => {
    await page.locator("body").click();
    await page.keyboard.press("Control+[");
    // The modal header has "Insertar cita" — use first() to avoid strict mode with sidebar text
    await expect(page.getByText(/insertar cita|insert citation/i).first()).toBeVisible({ timeout: 3000 });
  });

  test("citation picker shows add-via-DOI button when no refs", async ({ page }) => {
    await page.locator("body").click();
    await page.keyboard.press("Control+[");
    // The browser mock returns empty refs, so empty state should show
    await expect(page.getByText(/agregar.*doi|add.*doi/i).first()).toBeVisible({ timeout: 3000 });
  });

  test("citation picker closes on Escape", async ({ page }) => {
    await page.locator("body").click();
    await page.keyboard.press("Control+[");
    await expect(page.getByText(/insertar cita|insert citation/i).first()).toBeVisible({ timeout: 3000 });
    await page.keyboard.press("Escape");
    await expect(page.getByText(/insertar cita bibliográfica/i).first()).toBeHidden({ timeout: 2000 });
  });
});
