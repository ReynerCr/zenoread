import { test, expect } from "@playwright/test";

test.describe("Drag-and-drop file loading", () => {
  test("drop overlay appears when dragging a file over the reading area", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("button", { name: "Open file" })).toBeVisible({ timeout: 10000 });

    const readingArea = page.getByRole("region", { name: "Reading area" });

    // Dispatch a dragover event with a DataTransfer created in the browser context.
    await readingArea.evaluate((el) => {
      const dt = new DataTransfer();
      el.dispatchEvent(new DragEvent("dragover", { dataTransfer: dt, bubbles: true }));
    });

    await expect(page.getByTestId("drop-overlay")).toBeVisible();
    await expect(page.getByText("Drop file to open")).toBeVisible();
  });

  test("drop overlay disappears when dragging leaves the reading area", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("button", { name: "Open file" })).toBeVisible({ timeout: 10000 });

    const readingArea = page.getByRole("region", { name: "Reading area" });

    await readingArea.evaluate((el) => {
      const dt = new DataTransfer();
      el.dispatchEvent(new DragEvent("dragover", { dataTransfer: dt, bubbles: true }));
    });
    await expect(page.getByTestId("drop-overlay")).toBeVisible();

    // Simulate dragleave (relatedTarget = null means leaving the container).
    await readingArea.evaluate((el) => {
      const dt = new DataTransfer();
      el.dispatchEvent(new DragEvent("dragleave", { dataTransfer: dt, relatedTarget: null, bubbles: true }));
    });
    await expect(page.getByTestId("drop-overlay")).not.toBeVisible();
  });

  test("dropping a .txt file loads it into the reader", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("1 /")).toBeVisible({ timeout: 10000 });

    const fileContent = "Dropped Doc Title\n\nFirst sentence. Second sentence. Third sentence.";

    const readingArea = page.getByRole("region", { name: "Reading area" });
    await readingArea.evaluate((el, content) => {
      const file = new File([content], "dropped.txt", { type: "text/plain" });
      const dt = new DataTransfer();
      dt.items.add(file);
      el.dispatchEvent(new DragEvent("drop", { dataTransfer: dt, bubbles: true }));
    }, fileContent);

    // The title should appear in the reader.
    await expect(page.locator("span.max-w-xs", { hasText: "Dropped Doc Title" })).toBeVisible({ timeout: 5000 });
  });
});
