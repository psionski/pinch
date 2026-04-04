import { test, expect } from "@playwright/test";
import { waitForPageReady } from "./helpers";

test.describe.serial("Assets & Portfolio", () => {
  test("create deposit asset", async ({ page }) => {
    await page.goto("/assets");
    await waitForPageReady(page);
    await page.getByRole("button", { name: "Add Asset" }).click();

    await page.locator("#asset-name").fill("Emergency Fund");

    await page.getByRole("button", { name: "Create" }).click();
    await expect(page.locator("#asset-name")).not.toBeVisible({ timeout: 5000 });
    await expect(page.getByText("Emergency Fund")).toBeVisible();
  });

  test("deposit money into asset", async ({ page }) => {
    await page.goto("/assets");
    await waitForPageReady(page);

    // Navigate to asset detail via data-testid link
    await page.locator("[data-testid^='asset-link-']").first().click();
    await page.waitForURL("**/assets/**");
    await waitForPageReady(page);

    await page.getByRole("button", { name: "Deposit" }).click();

    const dialog = page.getByRole("dialog");
    await dialog.locator('input[type="number"]').first().fill("5000");
    await dialog.getByRole("button", { name: /Confirm|Submit|Deposit/i }).click();

    await expect(dialog).not.toBeVisible({ timeout: 5000 });
  });

  test("create investment asset", async ({ page }) => {
    await page.goto("/assets");
    await waitForPageReady(page);
    await page.getByRole("button", { name: "Add Asset" }).click();

    await page.locator("#asset-name").fill("Tech ETF");

    // Change type from Deposit (default) to Investment
    await page.locator("#asset-type").click();
    await page.locator("[role='option']").filter({ hasText: "Investment" }).click();

    await page.getByRole("button", { name: "Create" }).click();
    await expect(page.locator("#asset-name")).not.toBeVisible({ timeout: 5000 });
    await expect(page.getByText("Tech ETF", { exact: true })).toBeVisible();
  });

  test("record buy transaction for investment", async ({ page }) => {
    await page.goto("/assets");
    await waitForPageReady(page);

    // Navigate to Tech ETF detail (the last asset link)
    await page.locator("[data-testid^='asset-link-']").last().click();
    await page.waitForURL("**/assets/**");
    await waitForPageReady(page);

    await page.getByRole("button", { name: "Buy" }).click();

    const dialog = page.getByRole("dialog");
    const inputs = dialog.locator('input[type="number"]');
    await inputs.first().fill("10");
    if ((await inputs.count()) > 1) {
      await inputs.nth(1).fill("100");
    }

    await dialog.getByRole("button", { name: /Confirm|Submit|Buy/i }).click();
    await expect(dialog).not.toBeVisible({ timeout: 5000 });
  });
});
