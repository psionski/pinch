import { test, expect } from "@playwright/test";

test.describe.serial("Recurring transactions", () => {
  test("create monthly recurring", async ({ page }) => {
    await page.goto("/recurring");
    await page.getByRole("button", { name: "Add Recurring" }).click();

    await page.locator("#recurring-description").fill("Netflix Subscription");
    await page.locator("#recurring-amount").fill("15.99");
    await page.locator("#recurring-start").fill("2026-01-01");

    await page.getByRole("button", { name: "Create" }).click();
    await expect(page.locator("#recurring-description")).not.toBeVisible({ timeout: 5000 });
    await expect(page.getByText("Netflix Subscription")).toBeVisible();
  });

  test("toggle active/inactive", async ({ page }) => {
    await page.goto("/recurring");

    // Use data-testid to find the row, then its actions menu
    const row = page
      .locator("[data-testid^='recurring-row-']")
      .filter({ hasText: "Netflix Subscription" });
    const actionsBtn = row.locator("[data-testid^='recurring-actions-']");

    await actionsBtn.click();
    await page.getByRole("menuitem", { name: "Pause" }).click();
    await expect(row.getByText("Paused")).toBeVisible({ timeout: 5000 });

    await actionsBtn.click();
    await page.getByRole("menuitem", { name: "Resume" }).click();
    await expect(row.getByText("Active")).toBeVisible({ timeout: 5000 });
  });

  test("edit recurring details", async ({ page }) => {
    await page.goto("/recurring");

    const row = page
      .locator("[data-testid^='recurring-row-']")
      .filter({ hasText: "Netflix Subscription" });
    await row.locator("[data-testid^='recurring-actions-']").click();
    await page.getByRole("menuitem", { name: "Edit" }).click();

    await page.locator("#recurring-amount").clear();
    await page.locator("#recurring-amount").fill("17.99");
    await page.getByRole("button", { name: "Save Changes" }).click();
    await expect(page.locator("#recurring-amount")).not.toBeVisible({ timeout: 5000 });
  });

  test("delete recurring", async ({ page }) => {
    await page.goto("/recurring");

    const row = page
      .locator("[data-testid^='recurring-row-']")
      .filter({ hasText: "Netflix Subscription" });
    await row.locator("[data-testid^='recurring-actions-']").click();
    await page.getByRole("menuitem", { name: "Delete" }).click();

    await page.getByRole("dialog").getByRole("button", { name: "Delete" }).click();
    await expect(page.getByRole("dialog")).not.toBeVisible({ timeout: 5000 });
    await expect(row).not.toBeVisible({ timeout: 5000 });
  });
});
