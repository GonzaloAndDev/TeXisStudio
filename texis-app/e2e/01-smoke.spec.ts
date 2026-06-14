/**
 * Smoke tests — app loads and basic routing works.
 * Runs in browser mode (no Tauri), which auto-redirects to /demo.
 */

import { test, expect } from "@playwright/test";

test.describe("Smoke", () => {
  test("app renders without crashing", async ({ page }) => {
    await page.goto("/");
    // Either home or demo should render without a full error
    await expect(page.locator("body")).toBeVisible();
    // No JS error alert
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.waitForTimeout(500);
    expect(errors.filter((e) => !e.includes("ResizeObserver"))).toHaveLength(0);
  });

  test("demo mode loads the editor project", async ({ page }) => {
    // Navigate directly to /demo — DemoLoader opens the demo project and redirects to /project/demo
    await page.goto("/demo");
    await page.waitForURL(/\/project\/demo/, { timeout: 10_000 });
    await expect(page.locator("body")).toBeVisible();
  });

  test("/about page renders with version number", async ({ page }) => {
    await page.goto("/about");
    await page.waitForLoadState("networkidle");
    const body = page.locator("body");
    await expect(body).toBeVisible();
    // Should contain a version string like 1.x.x
    await expect(page.locator("body")).toContainText(/\d+\.\d+\.\d+/);
  });
});
