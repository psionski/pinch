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
  }
});

test("sidebar collapse and expand", async ({ page }) => {
  await page.goto("/");

  // Click the sidebar trigger to collapse
  const trigger = page.locator("button[data-sidebar='trigger']");
  await trigger.click();
  // Wait for collapse animation
  await page.waitForTimeout(500);

  // Verify sidebar is collapsed (nav text should be hidden)
  const sidebarNav = page.locator('[data-tour="sidebar-nav"]');
  const firstLink = sidebarNav.locator("a").first();
  // In collapsed state, the link text should not be visible
  await expect(firstLink).toBeVisible();

  // Click again to expand
  await trigger.click();
  await page.waitForTimeout(500);
});

test("mobile viewport hides sidebar", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await page.goto("/");

  // Sidebar should not be visible on mobile
  const sidebarNav = page.locator("[data-tour='sidebar-nav']");
  await expect(sidebarNav).not.toBeInViewport();
});

test("mobile sidebar opens as overlay", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await page.goto("/");

  // Click the trigger/hamburger to open sidebar
  const trigger = page.locator("button[data-sidebar='trigger']");
  await trigger.click();

  // Sidebar nav should now be visible
  const sidebarNav = page.locator("[data-tour='sidebar-nav']");
  await expect(sidebarNav).toBeVisible();
});

test.fail("mobile menu closes on nav item click", async ({ page }) => {
  // Known bug: clicking a menu item on mobile doesn't close the menu
  await page.setViewportSize({ width: 375, height: 667 });
  await page.goto("/");

  // Open the sidebar
  const trigger = page.locator("button[data-sidebar='trigger']");
  await trigger.click();

  const sidebarNav = page.locator("[data-tour='sidebar-nav']");
  await expect(sidebarNav).toBeVisible();

  // Click a nav item
  const link = page.locator(`[data-tour="sidebar-nav"] a[href="/transactions"]`);
  await link.click();
  await page.waitForURL("**/transactions");

  // Sidebar should close after navigation — this currently fails
  await expect(sidebarNav).not.toBeVisible();
});
