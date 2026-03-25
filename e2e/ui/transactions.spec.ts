import { test, expect } from "@playwright/test";
import { createCategoryViaUI } from "./helpers";

test.describe.serial("Transactions", () => {
  test("create a category as precondition", async ({ page }) => {
    await page.goto("/");
    await createCategoryViaUI(page, { name: "Groceries" });
  });

  test("add expense transaction", async ({ page }) => {
    await page.goto("/transactions");
    await page.getByRole("button", { name: "Add Transaction" }).click();

    await page.locator("#tx-amount").fill("12.50");
    await page.locator("#tx-description").fill("Lunch at cafe");

    await page.getByRole("button", { name: "Add Transaction" }).click();
    await expect(page.locator("#tx-amount")).not.toBeVisible({ timeout: 5000 });
    await expect(page.getByText("Lunch at cafe")).toBeVisible();
  });

  test("add income transaction", async ({ page }) => {
    await page.goto("/transactions");
    await page.getByRole("button", { name: "Add Transaction" }).click();

    await page.getByRole("button", { name: "Income", exact: true }).click();
    await page.locator("#tx-amount").fill("3000");
    await page.locator("#tx-description").fill("Monthly salary");

    await page.getByRole("button", { name: "Add Transaction" }).click();
    await expect(page.locator("#tx-amount")).not.toBeVisible({ timeout: 5000 });
    await expect(page.getByText("Monthly salary")).toBeVisible();
  });

  test("edit a transaction", async ({ page }) => {
    await page.goto("/transactions", { waitUntil: "networkidle" });
    const row = page.locator("tr").filter({ hasText: "Lunch at cafe" });
    await expect(row).toBeVisible();
    await row.getByLabel("Edit transaction").click();

    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 5000 });
    await page.locator("#tx-amount").fill("15.00");
    await page.getByRole("button", { name: "Save Changes" }).click();
    await expect(page.getByRole("dialog")).not.toBeVisible({ timeout: 5000 });
  });

  test("delete a transaction", async ({ page }) => {
    await page.goto("/transactions", { waitUntil: "networkidle" });
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

    // Add a categorized transaction
    await page.getByRole("button", { name: "Add Transaction" }).click();
    await page.locator("#tx-amount").fill("8.50");
    await page.locator("#tx-description").fill("Groceries run");
    await page.getByRole("button", { name: "Add Transaction" }).click();
    await expect(page.locator("#tx-amount")).not.toBeVisible({ timeout: 5000 });

    await expect(page.getByText("Groceries run")).toBeVisible();
  });
});
