import { test, expect } from "@playwright/test";

test.describe.serial("Seed data & interactive tour", () => {
  test("dashboard loads with sample data", async ({ page }) => {
    await page.goto("/");
    // KPI cards should have content (seeded data)
    await expect(page.locator('[data-tour="kpi-cards"]')).toBeVisible();
    // Sample data bar should be visible
    await expect(page.getByText("sample data")).toBeVisible();
  });

  test("sample data bar shows with clear button", async ({ page }) => {
    await page.goto("/");
    const bar = page.getByText("sample data").locator("..");
    await expect(bar).toBeVisible();
    await expect(page.getByRole("button", { name: "Clear sample data" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Clear sample data" })).toBeEnabled();
  });

  test("tutorial auto-starts after page load", async ({ page }) => {
    await page.goto("/");
    // Joyride overlay should appear within a reasonable time (500ms delay + render)
    await expect(page.getByText("Welcome to Pinch!")).toBeVisible({ timeout: 5000 });
  });

  test("tutorial can navigate and be skipped", async ({ page }) => {
    await page.goto("/");
    // Wait for the tour to start
    await expect(page.getByText("Welcome to Pinch!")).toBeVisible({ timeout: 5000 });

    // Click Next through a few steps
    await page.getByRole("button", { name: "Next" }).click();
    // Should show "At a Glance" step (KPI cards)
    await expect(page.getByText("At a Glance")).toBeVisible({ timeout: 5000 });

    await page.getByRole("button", { name: "Next" }).click();
    // Should show "Spending Charts" step
    await expect(page.getByText("Spending Charts")).toBeVisible({ timeout: 5000 });

    // Skip the rest of the tour
    await page.getByRole("button", { name: "Skip tour" }).click();

    // Tour should disappear — the overlay/tooltip should be gone
    await expect(page.getByText("Welcome to Pinch!")).not.toBeVisible({ timeout: 5000 });
    // Should be back on dashboard
    await expect(page).toHaveURL("/");
  });

  test("clear sample data deletes DB and redirects to /settings", async ({ page }) => {
    await page.goto("/");

    // Dismiss the tutorial first (it may have restarted since this is a new page instance,
    // but tutorial setting was updated to false in previous test — check if it shows)
    const skipButton = page.getByRole("button", { name: "Skip tour" });
    if (await skipButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await skipButton.click();
    }

    // Accept the native confirm dialog
    page.on("dialog", (dialog) => dialog.accept());

    // Click clear sample data
    await page.getByRole("button", { name: "Clear sample data" }).click();

    // Should redirect to /settings after DB is cleared and page refreshes
    await page.waitForURL("**/settings", { timeout: 15000 });

    // Verify we're on the first-setup page (no timezone configured)
    await expect(page.getByText("Timezone")).toBeVisible();
  });
});
