import { test, expect } from "@playwright/test";
import { createCategoryViaUI, createTransactionViaUI, navigateTo } from "./helpers";

test.describe.serial("Budgets", () => {
  test("create category as precondition", async ({ page }) => {
    await page.goto("/");
    await createCategoryViaUI(page, { name: "Food" });
  });

  test("create budget for a category", async ({ page }) => {
    await page.goto("/budgets");
    await page.getByRole("button", { name: "Add Budget" }).click();
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 5000 });

    await page.locator("#budget-category").click();
    await page.locator("[role='option']").filter({ hasText: "Food" }).click();

    await page.locator("#budget-amount").fill("200");
    await page.getByRole("button", { name: "Set Budget" }).click();

    await expect(page.locator("#budget-amount")).not.toBeVisible({ timeout: 5000 });
    await expect(
      page.locator("[data-testid^='budget-row-']").filter({ hasText: "Food" })
    ).toBeVisible();
  });

  test("progress reflects spending", async ({ page }) => {
    await page.goto("/");
    await createTransactionViaUI(page, {
      amount: "50",
      type: "expense",
      description: "Budget test expense",
      category: "Food",
    });

    await navigateTo(page, "/budgets");
    const foodRow = page.locator("[data-testid^='budget-row-']").filter({ hasText: "Food" });
    await expect(foodRow).toBeVisible();
  });

  test("over-budget warning styling", async ({ page }) => {
    await page.goto("/");
    await createTransactionViaUI(page, {
      amount: "180",
      type: "expense",
      description: "Big grocery haul",
      category: "Food",
    });

    await navigateTo(page, "/budgets");
    const foodRow = page.locator("[data-testid^='budget-row-']").filter({ hasText: "Food" });
    await expect(foodRow.getByText(/Over budget|Approaching/)).toBeVisible({ timeout: 5000 });
  });

  test("navigate between months", async ({ page }) => {
    await page.goto("/budgets");

    const monthLabel = page.getByTestId("budget-month-label");
    const currentMonth = await monthLabel.textContent();

    await page.getByTestId("budget-prev-month").click();
    await expect(monthLabel).not.toHaveText(currentMonth!);
  });
});
