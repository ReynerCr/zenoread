import { test, expect } from "@playwright/test";

test.describe("Settings sidebar — advanced pauses", () => {
  test("advanced section is collapsed by default and expands on click", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Toggle settings" }).click();

    const sidebar = page.getByRole("complementary", { name: "Settings" });
    const advancedBtn = sidebar.getByRole("button", { name: /Advanced pauses/ });
    await expect(advancedBtn).toBeVisible();
    await expect(advancedBtn).toHaveAttribute("aria-expanded", "false");

    // Pause sliders should not be visible yet.
    await expect(sidebar.locator("#advanced-pauses")).toBeHidden();

    await advancedBtn.click();
    await expect(advancedBtn).toHaveAttribute("aria-expanded", "true");
    await expect(sidebar.locator("#advanced-pauses")).toBeVisible();
  });

  test("exposes all seven pause multiplier sliders", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Toggle settings" }).click();

    const sidebar = page.getByRole("complementary", { name: "Settings" });
    await sidebar.getByRole("button", { name: /Advanced pauses/ }).click();

    const pauses = sidebar.locator("#advanced-pauses");
    await expect(pauses.getByLabel(/Period:/)).toBeVisible();
    await expect(pauses.getByLabel(/Comma:/)).toBeVisible();
    await expect(pauses.getByLabel(/Semicolon:/)).toBeVisible();
    await expect(pauses.getByLabel(/Colon:/)).toBeVisible();
    await expect(pauses.getByLabel(/Question:/)).toBeVisible();
    await expect(pauses.getByLabel(/Exclamation:/)).toBeVisible();
    await expect(pauses.getByLabel(/Paragraph:/)).toBeVisible();
  });

  test("reset to defaults button restores default values", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Toggle settings" }).click();

    const sidebar = page.getByRole("complementary", { name: "Settings" });
    await sidebar.getByRole("button", { name: /Advanced pauses/ }).click();

    const pauses = sidebar.locator("#advanced-pauses");
    const periodSlider = pauses.getByLabel(/Period:/);

    // Change the period multiplier via DOM (range inputs don't accept fill).
    await periodSlider.evaluate((el: HTMLInputElement) => {
      el.value = "4";
      el.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await expect(periodSlider).toHaveValue("4");

    // Reset.
    await pauses.getByRole("button", { name: "Reset to defaults" }).click();
    await expect(periodSlider).toHaveValue("2.5");
  });
});
