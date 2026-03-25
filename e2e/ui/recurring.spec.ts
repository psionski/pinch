import { test, expect } from "@playwright/test";

test.describe.serial("Recurring transactions", () => {
  test("create monthly recurring", async ({ page }) => {
    await page.goto("/recurring");
    await page.getByRole("button", { name: "Add Recurring" }).click();

    await page.locator("#recurring-description").fill("Netflix Subscription");
    await page.locator("#recurring-amount").fill("15.99");

    // Frequency should default to Monthly, but set it explicitly
    await page.locator("#recurring-frequency").click();
    await page.getByRole("option", { name: "Monthly" }).click();

    // Set a start date
    await page.locator("#recurring-start").fill("2026-01-01");

    await page.getByRole("button", { name: "Create" }).click();
    await expect(page.locator("#recurring-description")).not.toBeVisible({ timeout: 5000 });

    await expect(page.getByText("Netflix Subscription")).toBeVisible();
  });

  test("toggle active/inactive", async ({ page }) => {
    await page.goto("/recurring");

    // Open actions for Netflix
    const row = page.getByText("Netflix Subscription").locator("ancestor::tr");
    await row.getByRole("button").last().click();
    await page.getByRole("menuitem", { name: "Pause" }).click();

    // Status should change to Paused
    await expect(row.getByText("Paused")).toBeVisible({ timeout: 5000 });

    // Resume it
    await row.getByRole("button").last().click();
    await page.getByRole("menuitem", { name: "Resume" }).click();
    await expect(row.getByText("Active")).toBeVisible({ timeout: 5000 });
  });

  test("edit recurring details", async ({ page }) => {
    await page.goto("/recurring");

    const row = page.getByText("Netflix Subscription").locator("ancestor::tr");
    await row.getByRole("button").last().click();
    await page.getByRole("menuitem", { name: "Edit" }).click();

    // Change amount
    await page.locator("#recurring-amount").clear();
    await page.locator("#recurring-amount").fill("17.99");
    await page.getByRole("button", { name: "Save Changes" }).click();

    await expect(page.locator("#recurring-amount")).not.toBeVisible({ timeout: 5000 });
  });

  test("delete recurring", async ({ page }) => {
    await page.goto("/recurring");

    const row = page.getByText("Netflix Subscription").locator("ancestor::tr");
    await row.getByRole("button").last().click();
    await page.getByRole("menuitem", { name: "Delete" }).click();

    // Confirm deletion
    await page.getByRole("button", { name: "Delete" }).click();

    await expect(page.getByText("Netflix Subscription")).not.toBeVisible({ timeout: 5000 });
  });
});
