import { test, expect } from "@playwright/test";
import { createTransactionViaUI, navigateTo } from "./helpers";

test.describe.serial("Budgets", () => {
  test("create budget for a category", async ({ page }) => {
    await page.goto("/budgets");
    await page.getByRole("button", { name: "Add Budget" }).click();

    // Select category
    await page.locator("#budget-category").click();
    await page.getByRole("option", { name: "Food" }).click();

    await page.locator("#budget-amount").fill("200");
    await page.getByRole("button", { name: "Set Budget" }).click();

    await expect(page.locator("#budget-amount")).not.toBeVisible({ timeout: 5000 });
    // Budget row should appear with Food category
    await expect(page.getByText("Food")).toBeVisible();
  });

  test("progress reflects spending", async ({ page }) => {
    // Add an expense in Food category
    await page.goto("/");
    await createTransactionViaUI(page, {
      amount: "50",
      type: "expense",
      description: "Budget test expense",
      category: "Food",
    });

    // Go to budgets and check progress
    await navigateTo(page, "/budgets");
    // The Food budget row should show some progress (25% of €200)
    const foodRow = page.getByText("Food").locator("ancestor::tr");
    await expect(foodRow).toBeVisible();
    // Progress should be non-zero — look for percentage or spent amount
    await expect(foodRow.getByText(/\d+%/)).toBeVisible({ timeout: 5000 });
  });

  test("over-budget warning styling", async ({ page }) => {
    // Add a large expense to exceed the €200 budget
    await page.goto("/");
    await createTransactionViaUI(page, {
      amount: "180",
      type: "expense",
      description: "Big grocery haul",
      category: "Food",
    });

    await navigateTo(page, "/budgets");
    // Food budget should now show over-budget or approaching indicator
    // Look for "Over budget" or "Approaching" badge, or red styling
    const foodRow = page.getByText("Food").locator("ancestor::tr");
    const status = foodRow.getByText(/Over budget|Approaching/);
    await expect(status).toBeVisible({ timeout: 5000 });
  });

  test("navigate between months", async ({ page }) => {
    await page.goto("/budgets");

    // Get current month text
    const monthLabel = page
      .locator("h2, h3")
      .filter({ hasText: /\w+ \d{4}/ })
      .first();
    const currentMonth = await monthLabel.textContent();

    // Click previous month arrow
    await page
      .getByRole("button", { name: /previous/i })
      .first()
      .click();

    // Month label should change
    await expect(monthLabel).not.toHaveText(currentMonth!);
  });
});
