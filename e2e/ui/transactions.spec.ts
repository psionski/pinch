import { test, expect } from "@playwright/test";
import { createCategoryViaUI, waitForPageReady } from "./helpers";

test.describe.serial("Transactions", () => {
  test("create a category as precondition", async ({ page }) => {
    await page.goto("/");
    await waitForPageReady(page);
    await createCategoryViaUI(page, { name: "Groceries" });
  });

  test("add expense transaction", async ({ page }) => {
    await page.goto("/transactions");
    await waitForPageReady(page);
    await page.getByRole("button", { name: "Add Transaction" }).click();

    await page.locator("#tx-amount").fill("12.50");
    await page.locator("#tx-description").fill("Lunch at cafe");

    await page.getByRole("button", { name: "Add Transaction" }).click();
    await expect(page.locator("#tx-amount")).not.toBeVisible({ timeout: 5000 });
    const expenseRow = page.locator("tr").filter({ hasText: "Lunch at cafe" });
    await expect(expenseRow).toBeVisible();
    await expect(expenseRow).toContainText("12,50");
  });

  test("add income transaction", async ({ page }) => {
    await page.goto("/transactions");
    await waitForPageReady(page);
    await page.getByRole("button", { name: "Add Transaction" }).click();

    await page.getByRole("button", { name: "Income", exact: true }).click();
    await page.locator("#tx-amount").fill("3000");
    await page.locator("#tx-description").fill("Monthly salary");

    await page.getByRole("button", { name: "Add Transaction" }).click();
    await expect(page.locator("#tx-amount")).not.toBeVisible({ timeout: 5000 });
    const incomeRow = page.locator("tr").filter({ hasText: "Monthly salary" });
    await expect(incomeRow).toBeVisible();
    await expect(incomeRow).toContainText("3.000,00");
  });

  test("edit a transaction", async ({ page }) => {
    await page.goto("/transactions");
    await waitForPageReady(page);
    const row = page.locator("tr").filter({ hasText: "Lunch at cafe" });
    await expect(row).toBeVisible();
    await row.getByLabel("Transaction actions").click();
    await page.getByRole("menuitem", { name: "Edit" }).click();

    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 5000 });
    await page.locator("#tx-amount").fill("15.00");
    await page.getByRole("button", { name: "Save Changes" }).click();
    await expect(page.getByRole("dialog")).not.toBeVisible({ timeout: 5000 });
    const editedRow = page.locator("tr").filter({ hasText: "Lunch at cafe" });
    await expect(editedRow).toContainText("15,00");
  });

  test("delete a transaction", async ({ page }) => {
    await page.goto("/transactions");
    await waitForPageReady(page);
    const row = page.locator("tr").filter({ hasText: "Monthly salary" });
    await row.getByRole("checkbox").click();

    // Wait for bulk action bar to appear, then click Delete
    await expect(page.getByRole("button", { name: "Delete" })).toBeVisible();
    await page.getByRole("button", { name: "Delete" }).click();

    // Confirm in the dialog
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.getByRole("dialog").getByRole("button", { name: "Delete" }).click();

    await expect(page.getByText("Monthly salary")).not.toBeVisible({ timeout: 5000 });
  });

  test("filter transactions by category", async ({ page }) => {
    await page.goto("/transactions");
    await waitForPageReady(page);

    // Add a categorized transaction
    await page.getByRole("button", { name: "Add Transaction" }).click();
    await page.locator("#tx-amount").fill("8.50");
    await page.locator("#tx-description").fill("Groceries run");
    await page.getByRole("button", { name: "Add Transaction" }).click();
    await expect(page.locator("#tx-amount")).not.toBeVisible({ timeout: 5000 });

    await expect(page.getByText("Groceries run")).toBeVisible();
  });
});
