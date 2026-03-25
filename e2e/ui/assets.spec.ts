import { test, expect } from "@playwright/test";
import { navigateTo } from "./helpers";

test.describe.serial("Assets & Portfolio", () => {
  test("create deposit asset", async ({ page }) => {
    await page.goto("/assets");
    await page.getByRole("button", { name: "Add Asset" }).click();

    await page.locator("#asset-name").fill("Emergency Fund");

    // Select Deposit type
    const typeSelect = page.locator("#asset-type");
    if (await typeSelect.isVisible().catch(() => false)) {
      await typeSelect.click();
      await page.getByRole("option", { name: /Deposit/i }).click();
    }

    await page.getByRole("button", { name: "Create" }).click();
    await expect(page.locator("#asset-name")).not.toBeVisible({ timeout: 5000 });

    await expect(page.getByText("Emergency Fund")).toBeVisible();
  });

  test("deposit money into asset", async ({ page }) => {
    await page.goto("/assets");

    // Click into the asset
    await page.getByText("Emergency Fund").click();

    // Look for deposit/add button
    const depositButton = page.getByRole("button", { name: /Deposit/i });
    await depositButton.click();

    // Fill deposit form
    const amountInput = page.locator('input[type="number"]').first();
    await amountInput.fill("5000");

    await page.getByRole("button", { name: /Confirm|Submit|Deposit/i }).click();

    // Balance should update
    await expect(page.getByText(/5[,.]?000/)).toBeVisible({ timeout: 5000 });
  });

  test("create investment asset", async ({ page }) => {
    await navigateTo(page, "/assets");
    await page.getByRole("button", { name: "Add Asset" }).click();

    await page.locator("#asset-name").fill("Tech ETF");

    const typeSelect = page.locator("#asset-type");
    if (await typeSelect.isVisible().catch(() => false)) {
      await typeSelect.click();
      await page.getByRole("option", { name: /Investment/i }).click();
    }

    await page.getByRole("button", { name: "Create" }).click();
    await expect(page.locator("#asset-name")).not.toBeVisible({ timeout: 5000 });

    await expect(page.getByText("Tech ETF")).toBeVisible();
  });

  test("record buy transaction for investment", async ({ page }) => {
    await page.goto("/assets");

    // Click into Tech ETF
    await page.getByText("Tech ETF").click();

    // Look for Buy button
    const buyButton = page.getByRole("button", { name: /Buy/i });
    await buyButton.click();

    // Fill buy form — quantity and price
    const inputs = page.locator('input[type="number"]');
    await inputs.first().fill("10"); // quantity
    if ((await inputs.count()) > 1) {
      await inputs.nth(1).fill("100"); // price per unit
    }

    await page.getByRole("button", { name: /Confirm|Submit|Buy/i }).click();

    // Should see the lot or updated portfolio value
    await expect(page.getByText(/1[,.]?000/)).toBeVisible({ timeout: 5000 });
  });
});
