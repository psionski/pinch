import { test, expect } from "@playwright/test";
import { navigateTo } from "./helpers";

test.describe.serial("Categories", () => {
  test("create parent category", async ({ page }) => {
    await page.goto("/categories");
    await page.getByRole("button", { name: "Add Category" }).click();

    await page.locator("#cat-name").fill("Transport");
    await page.getByRole("button", { name: "Create" }).click();

    await expect(page.locator("#cat-name")).not.toBeVisible({ timeout: 5000 });
    await expect(page.getByText("Transport")).toBeVisible();
  });

  test("create child category", async ({ page }) => {
    await page.goto("/categories");
    await page.getByRole("button", { name: "Add Category" }).click();

    await page.locator("#cat-name").fill("Bus");
    // Select parent
    await page.locator("#cat-parent").click();
    await page.getByRole("option", { name: "Transport" }).click();

    await page.getByRole("button", { name: "Create" }).click();
    await expect(page.locator("#cat-name")).not.toBeVisible({ timeout: 5000 });
    await expect(page.getByText("Bus")).toBeVisible();
  });

  test("edit category (rename)", async ({ page }) => {
    await page.goto("/categories");

    // Open actions menu for "Bus"
    const busRow = page.getByText("Bus").locator("ancestor::tr");
    await busRow.getByRole("button").last().click();
    await page.getByRole("menuitem", { name: "Edit" }).click();

    // Rename
    await page.locator("#cat-name").clear();
    await page.locator("#cat-name").fill("Public Transit");
    await page.getByRole("button", { name: "Save Changes" }).click();

    await expect(page.locator("#cat-name")).not.toBeVisible({ timeout: 5000 });
    await expect(page.getByText("Public Transit")).toBeVisible();
  });

  test("delete category", async ({ page }) => {
    await page.goto("/categories");

    // Open actions for "Public Transit"
    const row = page.getByText("Public Transit").locator("ancestor::tr");
    await row.getByRole("button").last().click();
    await page.getByRole("menuitem", { name: "Delete" }).click();

    // Confirm deletion
    await page.getByRole("button", { name: "Delete" }).click();

    await expect(page.getByText("Public Transit")).not.toBeVisible({ timeout: 5000 });
  });

  test("merge two categories", async ({ page }) => {
    await page.goto("/categories");

    // Create a second category to merge
    await page.getByRole("button", { name: "Add Category" }).click();
    await page.locator("#cat-name").fill("Supermarket");
    await page.getByRole("button", { name: "Create" }).click();
    await expect(page.locator("#cat-name")).not.toBeVisible({ timeout: 5000 });

    // Merge "Supermarket" into "Food" (which was created in transactions suite)
    const row = page.getByText("Supermarket").locator("ancestor::tr");
    await row.getByRole("button").last().click();
    await page.getByRole("menuitem", { name: /Merge/ }).click();

    // Select target category
    const targetSelect = page.getByRole("dialog").locator("select, [role='combobox']").first();
    await targetSelect.click();
    await page.getByRole("option", { name: "Food" }).click();

    await page.getByRole("button", { name: "Merge" }).click();

    // Supermarket should be gone
    await expect(page.getByText("Supermarket")).not.toBeVisible({ timeout: 5000 });
  });
});
