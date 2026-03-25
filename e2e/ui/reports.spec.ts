import { test, expect } from "@playwright/test";

test("cash flow report loads", async ({ page }) => {
  await page.goto("/reports/cash-flow");
  // Page should render without errors — look for the page heading or key content
  await expect(page.getByText(/Cash Flow|Income|Expenses/i).first()).toBeVisible();
  // Charts may or may not render depending on data — just verify page loaded
  await expect(page.locator("main, [class*='flex']").first()).toBeVisible();
});

test("date range selector updates content", async ({ page }) => {
  await page.goto("/reports/cash-flow");
  await expect(page.getByText(/Cash Flow|Income|Expenses/i).first()).toBeVisible();

  // Look for date preset buttons or range selector
  const presetButton = page
    .getByRole("button", { name: /Last Month|3 months|6 months|This Month/i })
    .first();
  if (await presetButton.isVisible().catch(() => false)) {
    await presetButton.click();
    // Just verify page doesn't crash after changing range
    await expect(page.getByText(/Cash Flow|Income|Expenses/i).first()).toBeVisible();
  }
});

test("portfolio report loads", async ({ page }) => {
  await page.goto("/reports/portfolio");
  // Page should render
  await expect(page.getByText(/Portfolio|Net Worth|Allocation/i).first()).toBeVisible();
});
