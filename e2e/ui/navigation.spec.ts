import { test, expect } from "@playwright/test";

const navItems = [
  { name: "Dashboard", href: "/" },
  { name: "Transactions", href: "/transactions" },
  { name: "Recurring", href: "/recurring" },
  { name: "Budgets", href: "/budgets" },
  { name: "Categories", href: "/categories" },
  { name: "Assets", href: "/assets" },
  { name: "Cash Flow", href: "/reports/cash-flow" },
  { name: "Portfolio", href: "/reports/portfolio" },
  { name: "Settings", href: "/settings" },
];

test("all sidebar links navigate correctly", async ({ page }) => {
  await page.goto("/");
  for (const item of navItems) {
    const link = page.locator(`[data-tour="sidebar-nav"] a[href="${item.href}"]`);
    await link.click();
    await page.waitForURL(`**${item.href}`);
    await expect(page).toHaveURL(new RegExp(`${item.href.replace("/", "/")}$`));
  }
});

test("sidebar collapse and expand", async ({ page }) => {
  await page.goto("/");
  const sidebar = page.locator("[data-sidebar]").first();
  await expect(sidebar).toBeVisible();

  // Click the sidebar trigger to collapse
  const trigger = page.locator("button[data-sidebar='trigger']");
  await trigger.click();
  // Sidebar should now have collapsed state
  await expect(sidebar).toHaveAttribute("data-state", "collapsed");

  // Click again to expand
  await trigger.click();
  await expect(sidebar).toHaveAttribute("data-state", "expanded");
});

test("mobile viewport hides sidebar", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await page.goto("/");

  // Sidebar should not be visible on mobile
  const sidebar = page.locator("[data-sidebar='sidebar']");
  await expect(sidebar).not.toBeInViewport();
});

test("mobile sidebar opens as overlay", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await page.goto("/");

  // Click the trigger/hamburger to open sidebar
  const trigger = page.locator("button[data-sidebar='trigger']");
  await trigger.click();

  // Sidebar should now be visible as overlay
  const sidebar = page.locator("[data-sidebar='sidebar']");
  await expect(sidebar).toBeVisible();
});

test.fail("mobile menu closes on nav item click", async ({ page }) => {
  // Known bug: clicking a menu item on mobile doesn't close the menu
  await page.setViewportSize({ width: 375, height: 667 });
  await page.goto("/");

  // Open the sidebar
  const trigger = page.locator("button[data-sidebar='trigger']");
  await trigger.click();

  const sidebar = page.locator("[data-sidebar='sidebar']");
  await expect(sidebar).toBeVisible();

  // Click a nav item
  const link = page.locator(`[data-tour="sidebar-nav"] a[href="/transactions"]`);
  await link.click();
  await page.waitForURL("**/transactions");

  // Sidebar should close after navigation — this currently fails
  await expect(sidebar).not.toBeVisible();
});
