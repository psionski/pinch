import { test, expect } from "@playwright/test";
import { waitForPageReady } from "./helpers";

test.describe.serial("Categories", () => {
  test("create parent category", async ({ page }) => {
    await page.goto("/categories");
    await waitForPageReady(page);
    await page.getByRole("button", { name: "Add Category" }).click();

    await page.locator("#cat-name").fill("Transport");
    await page.getByRole("button", { name: "Create" }).click();

    await expect(page.locator("#cat-name")).not.toBeVisible({ timeout: 5000 });
    await expect(page.locator("tbody").getByText("Transport")).toBeVisible();
  });

  test("create child category", async ({ page }) => {
    await page.goto("/categories");
    await waitForPageReady(page);
    await page.getByRole("button", { name: "Add Category" }).click();

    await page.locator("#cat-name").fill("Bus");
    await page.locator("#cat-parent").click();
    await page.getByRole("option", { name: "Transport" }).click();

    await page.getByRole("button", { name: "Create" }).click();
    await expect(page.locator("#cat-name")).not.toBeVisible({ timeout: 5000 });
    // Child category should be visible (parent auto-expands after adding child)
    await expect(
      page.locator("[data-testid^='category-row-']").filter({ hasText: "Bus" })
    ).toBeVisible({ timeout: 5000 });
  });

  test("edit category (rename)", async ({ page }) => {
    await page.goto("/categories");
    await waitForPageReady(page);

    // Click actions menu on the "Bus" row via data-testid
    const busRow = page.locator("[data-testid^='category-row-']").filter({ hasText: "Bus" });
    await busRow.locator("[data-testid^='category-actions-']").click();
    await page.getByRole("menuitem", { name: "Edit" }).click();

    await page.locator("#cat-name").clear();
    await page.locator("#cat-name").fill("Public Transit");
    await page.getByRole("button", { name: "Save Changes" }).click();

    await expect(page.locator("#cat-name")).not.toBeVisible({ timeout: 5000 });
    await expect(page.locator("tbody").getByText("Public Transit")).toBeVisible();
  });

  test("delete category", async ({ page }) => {
    await page.goto("/categories");
    await waitForPageReady(page);

    const row = page
      .locator("[data-testid^='category-row-']")
      .filter({ hasText: "Public Transit" });
    await row.locator("[data-testid^='category-actions-']").click();
    await page.getByRole("menuitem", { name: "Delete" }).click();

    await page.getByRole("dialog").getByRole("button", { name: "Delete" }).click();
    await expect(row).not.toBeVisible({ timeout: 5000 });
  });

  test("merge two categories", async ({ page }) => {
    await page.goto("/categories");
    await waitForPageReady(page);

    // Create a second category to merge
    await page.getByRole("button", { name: "Add Category" }).click();
    await page.locator("#cat-name").fill("Supermarket");
    await page.getByRole("button", { name: "Create" }).click();
    await expect(page.locator("#cat-name")).not.toBeVisible({ timeout: 5000 });

    // Open actions on "Supermarket" row and click Merge
    const row = page.locator("[data-testid^='category-row-']").filter({ hasText: "Supermarket" });
    await row.locator("[data-testid^='category-actions-']").click();
    await page.getByRole("menuitem", { name: /Merge/ }).click();

    // Select target category in merge dialog
    await page.locator("#merge-target").click();
    await page.locator("[role='option']").filter({ hasText: "Food" }).click();

    await page.getByRole("dialog").getByRole("button", { name: "Merge" }).click();
    // Verify Supermarket row is gone from the category tree
    await expect(
      page.locator("[data-testid^='category-row-']").filter({ hasText: "Supermarket" })
    ).not.toBeVisible({ timeout: 5000 });
  });
});
