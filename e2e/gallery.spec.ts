import { test, expect } from "@playwright/test";

test("public gallery switches layouts and sorts in both directions", async ({ page }) => {
  await page.goto("/images?view=templates");
  await expect(page.getByRole("heading", { name: "Images", exact: true })).toBeVisible();
  await expect(page.locator(".image-grid img").first()).toHaveAttribute("alt", "Newer test meme");
  await page.getByRole("button", { name: "Oldest first", exact: true }).click();
  await expect(page.locator(".image-grid img").first()).toHaveAttribute("alt", "Older test meme");
  await page.getByRole("button", { name: "List", exact: true }).click();
  await expect(page.locator(".image-list img").first()).toHaveAttribute("alt", "Older test meme");
  await page.getByRole("button", { name: "Table", exact: true }).click();
  await expect(page.getByRole("table")).toBeVisible();
  await expect(page.getByRole("row")).toHaveCount(3);
  await page.getByRole("button", { name: "Newest first", exact: true }).click();
  await expect(page.locator(".image-table img").first()).toHaveAttribute("alt", "Newer test meme");
  await page.getByRole("button", { name: "Cards", exact: true }).click();
  await page.getByRole("button", { name: /Open image 1/ }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).not.toBeVisible();
});

test("anonymous visitors cannot access profile or members", async ({ page }) => {
  for (const route of ["/profile", "/members"]) {
    await page.goto(route);
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole("heading", { name: "Sign in", exact: true })).toBeVisible();
  }
});

test("a first-visit OAuth return to the site root is handled instead of silently showing the gallery", async ({page}) => {
  // A deliberately invalid code must reach the callback and its recoverable error.
  // This exercises routing, not Google or a successful real OAuth exchange.
  await page.goto("/?code=invalid-e2e-code&next=https://example.invalid");
  await expect(page).toHaveURL(/\/auth\/error$/);
  await expect(page.getByRole("heading", {name:"Sign-in wasn’t completed"})).toBeVisible();
  await expect(page.getByRole("heading", {name:"Images",exact:true})).toHaveCount(0);
});
