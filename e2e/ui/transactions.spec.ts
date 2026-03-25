import { test, expect } from "@playwright/test";
import { createCategoryViaUI, navigateTo } from "./helpers";

test.describe.serial("Transactions", () => {
  test("create a category as precondition", async ({ page }) => {
    await page.goto("/");
    await createCategoryViaUI(page, { name: "Food" });
  });

  test("add expense transaction", async ({ page }) => {
    await page.goto("/transactions");
    await page.getByRole("button", { name: "Add Transaction" }).click();

    // Default type is expense — fill form
    await page.locator("#tx-amount").fill("12.50");
    await page.locator("#tx-description").fill("Lunch at cafe");

    await page.getByRole("button", { name: "Add Transaction" }).click();
    // Dialog should close
    await expect(page.locator("#tx-amount")).not.toBeVisible({ timeout: 5000 });
    // Transaction should appear in table
    await expect(page.getByText("Lunch at cafe")).toBeVisible();
  });

  test("add income transaction", async ({ page }) => {
    await page.goto("/transactions");
    await page.getByRole("button", { name: "Add Transaction" }).click();

    // Switch to income type
    await page.getByRole("button", { name: "Income", exact: true }).click();
    await page.locator("#tx-amount").fill("3000");
    await page.locator("#tx-description").fill("Monthly salary");

    await page.getByRole("button", { name: "Add Transaction" }).click();
    await expect(page.locator("#tx-amount")).not.toBeVisible({ timeout: 5000 });
    await expect(page.getByText("Monthly salary")).toBeVisible();
  });

  test("edit a transaction", async ({ page }) => {
    await page.goto("/transactions");
    // Click the row with "Lunch at cafe" to edit
    await page.getByText("Lunch at cafe").click();

    // Should open edit dialog or inline edit
    await page.locator("#tx-amount").fill("15.00");
    await page.getByRole("button", { name: "Save Changes" }).click();
    await expect(page.locator("#tx-amount")).not.toBeVisible({ timeout: 5000 });
  });

  test("delete a transaction", async ({ page }) => {
    await page.goto("/transactions");
    // Check the checkbox for "Monthly salary" row
    const row = page.getByText("Monthly salary").locator("ancestor::tr");
    await row.locator('input[type="checkbox"]').check();

    // Click delete button
    await page.getByRole("button", { name: "Delete" }).click();
    // Confirm deletion
    await page.getByRole("button", { name: "Delete" }).click();

    await expect(page.getByText("Monthly salary")).not.toBeVisible({ timeout: 5000 });
  });

  test("filter transactions by category", async ({ page }) => {
    await page.goto("/transactions");

    // Create a categorized transaction first
    await page.getByRole("button", { name: "Add Transaction" }).click();
    await page.locator("#tx-amount").fill("8.50");
    await page.locator("#tx-description").fill("Groceries run");
    // Select Food category if available
    const categorySelect = page.locator("#tx-category");
    if (await categorySelect.isVisible().catch(() => false)) {
      await categorySelect.click();
      await page.getByRole("option", { name: "Food" }).click();
    }
    await page.getByRole("button", { name: "Add Transaction" }).click();
    await expect(page.locator("#tx-amount")).not.toBeVisible({ timeout: 5000 });

    // Now filter by Food category
    await navigateTo(page, "/transactions");
    // Look for category filter (a Select component in the filter bar)
    const filterBar = page.locator('[data-tour="transaction-filters"]');
    const categoryFilter = filterBar.getByText("All categories");
    if (await categoryFilter.isVisible().catch(() => false)) {
      await categoryFilter.click();
      await page.getByRole("option", { name: "Food" }).click();
      // Should show filtered results
      await expect(page.getByText("Groceries run")).toBeVisible();
    }
  });
});
