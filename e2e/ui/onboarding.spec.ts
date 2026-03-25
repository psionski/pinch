import { test, expect } from "@playwright/test";

test.describe.serial("Onboarding wizard", () => {
  test("redirects / to /settings when no timezone", async ({ page }) => {
    await page.goto("/");
    await page.waitForURL("**/settings");
  });

  test("settings page shows first-setup UI", async ({ page }) => {
    await page.goto("/settings");
    // Timezone picker should be visible
    await expect(page.getByText("Timezone")).toBeVisible();
    // Continue button (first-time label)
    await expect(page.getByRole("button", { name: "Continue" })).toBeVisible();
  });

  test("setting timezone reveals cash balance section", async ({ page }) => {
    await page.goto("/settings");

    // Open the timezone picker and search for Amsterdam
    await page.getByRole("button", { name: /timezone/i }).click();
    await page.getByPlaceholder("Search timezones...").fill("Amsterdam");
    await page.getByText("Europe/Amsterdam").click();

    // Click Continue
    await page.getByRole("button", { name: "Continue" }).click();

    // Cash balance section should appear
    await expect(page.getByText("Checking Account Balance")).toBeVisible({ timeout: 5000 });
  });

  test("skip remaining steps and finish", async ({ page }) => {
    await page.goto("/settings");

    // Timezone is already set from previous test, so sections should be revealed.
    // Skip through remaining onboarding sections.
    // Click Skip buttons until we get to Finish Setup
    const skipButtons = page.getByRole("button", { name: "Skip" });
    while (
      await skipButtons
        .first()
        .isVisible({ timeout: 2000 })
        .catch(() => false)
    ) {
      await skipButtons.first().click();
      // Small wait for next section to reveal
      await page.waitForTimeout(300);
    }

    // Look for Finish Setup button
    const finishButton = page.getByRole("button", { name: "Finish Setup" });
    if (await finishButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await finishButton.click();
    }

    // Should redirect to dashboard
    await page.waitForURL("/", { timeout: 10000 });
  });

  test("dashboard loads empty after onboarding", async ({ page }) => {
    await page.goto("/");
    // Should NOT have sample data bar
    await expect(page.getByText("sample data")).not.toBeVisible();
    // Should NOT have tutorial overlay
    await expect(page.getByText("Welcome to Pinch!")).not.toBeVisible();
    // Page should load without errors
    await expect(page.locator('[data-tour="kpi-cards"]')).toBeVisible();
  });
});
