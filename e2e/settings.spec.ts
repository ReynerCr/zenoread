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
    for (const label of ["Period", "Comma", "Semicolon", "Colon", "Question", "Exclamation", "Paragraph"]) {
      await expect(pauses.getByLabel(new RegExp(`${label}:`))).toBeVisible();
    }
  });

  test("reset pauses button restores default values", async ({ page }) => {
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
    await pauses.getByRole("button", { name: "Reset pauses to defaults" }).click();
    await expect(periodSlider).toHaveValue("2.5");
  });
});

test.describe("Settings sidebar — slider + number input", () => {
  test("WPM slider and number input stay in sync", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Toggle settings" }).click();

    const sidebar = page.getByRole("complementary", { name: "Settings" });
    const wpmSlider = sidebar.getByLabel(/Reading speed:/);
    const wpmNumber = sidebar.locator("#number-reading-speed");

    // Wait for settings to load from RxDB (avoids race with optimistic updates).
    await expect(sidebar).toHaveAttribute("data-settings-loaded", "true", { timeout: 10000 });
    await expect(wpmSlider).toHaveValue("300");
    await expect(wpmNumber).toHaveValue("300");

    // Change via number input to a non-step value — slider snaps to nearest step.
    await wpmNumber.fill("205");
    await wpmNumber.press("Enter");
    // Number input keeps the exact value.
    await expect(wpmNumber).toHaveValue("205");
    // Slider snaps to nearest step=10 (either 200 or 210 depending on browser).
    const sliderVal = await wpmSlider.inputValue();
    expect(Number(sliderVal)).toBeGreaterThanOrEqual(200);
    expect(Number(sliderVal)).toBeLessThanOrEqual(210);
  });

  test("max words slider goes up to 15", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Toggle settings" }).click();

    const sidebar = page.getByRole("complementary", { name: "Settings" });
    const maxWordsSlider = sidebar.getByLabel(/Words per screen:/);

    // Move slider to max.
    await maxWordsSlider.evaluate((el: HTMLInputElement) => {
      el.value = "15";
      el.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await expect(maxWordsSlider).toHaveValue("15");
  });

  test("min/max labels are visible on sliders", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Toggle settings" }).click();

    const sidebar = page.getByRole("complementary", { name: "Settings" });

    // WPM slider should show 100 and 1000 at the ends.
    const wpmSection = sidebar.locator("div", { has: page.getByLabel(/Reading speed:/) }).first();
    await expect(wpmSection).toContainText("100");
    await expect(wpmSection).toContainText("1000");
  });
});

test.describe("Settings sidebar — reset buttons", () => {
  test("Reset all settings button restores defaults", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Toggle settings" }).click();

    const sidebar = page.getByRole("complementary", { name: "Settings" });

    // Wait for settings to load from RxDB (avoids race with optimistic updates).
    await expect(sidebar).toHaveAttribute("data-settings-loaded", "true", { timeout: 10000 });

    // Change WPM.
    const wpmNumber = sidebar.locator("#number-reading-speed");
    await wpmNumber.fill("500");
    await wpmNumber.press("Enter");

    // Confirm the change took effect.
    await expect(sidebar.getByLabel(/Reading speed:/)).toHaveValue("500");

    // Click reset and accept confirmation.
    page.once("dialog", (dialog) => dialog.accept());
    await sidebar.getByRole("button", { name: "Reset all settings" }).click();

    // WPM should be back to default (300).
    await expect(sidebar.getByLabel(/Reading speed:/)).toHaveValue("300");
  });

  test("Clear history button shows confirmation dialog", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Toggle settings" }).click();

    const sidebar = page.getByRole("complementary", { name: "Settings" });
    const deleteBtn = sidebar.getByRole("button", { name: "Clear history" });

    // Decline the confirmation — should not reload.
    page.once("dialog", (dialog) => dialog.dismiss());
    await deleteBtn.click();

    // Page should still be there.
    await expect(sidebar).toBeVisible();
  });
});
