import { test, expect } from "@playwright/test";

test("app shell renders with header and reading area", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("banner")).toContainText("ZenoRead");
  await expect(page.getByLabel("Reading area")).toBeVisible();
});

test("settings sidebar toggles open and exposes controls", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("button", { name: "Toggle settings" }).click();

  const sidebar = page.getByRole("complementary", { name: "Settings" });
  await expect(sidebar).toBeVisible();

  // Assert on the interactive widgets (font-independent intrinsic size) and on
  // text *content* rather than rendered glyph height, so the smoke test stays
  // robust in headless environments without system fonts installed.
  await expect(sidebar.getByRole("slider").first()).toBeVisible();
  await expect(sidebar).toContainText("Reading speed (WPM):");
});
