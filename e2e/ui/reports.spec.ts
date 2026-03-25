import { test, expect } from "@playwright/test";
import { navigateTo } from "./helpers";

test("cash flow report loads", async ({ page }) => {
  await page.goto("/reports/cash-flow");
  // Page should render without errors
  await expect(page.getByText(/Cash Flow|Income|Expenses/i).first()).toBeVisible();
  // Charts should be present (Recharts renders SVG elements)
  await expect(page.locator(".recharts-wrapper").first()).toBeVisible({ timeout: 10000 });
});

test("date range selector updates content", async ({ page }) => {
  await page.goto("/reports/cash-flow");
  await expect(page.locator(".recharts-wrapper").first()).toBeVisible({ timeout: 10000 });

  // Look for date preset buttons or selectors
  const presetButton = page.getByRole("button", { name: /Last Month|3 months|6 months/i }).first();
  if (await presetButton.isVisible().catch(() => false)) {
    await presetButton.click();
    // Content should update — just verify page doesn't error
    await expect(page.locator(".recharts-wrapper").first()).toBeVisible({ timeout: 10000 });
  }
});

test("portfolio report loads", async ({ page }) => {
  await page.goto("/reports/portfolio");
  // Page should render
  await expect(page.getByText(/Portfolio|Net Worth|Allocation/i).first()).toBeVisible();
});
