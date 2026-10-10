import { test, expect, login } from "./fixtures";
import sharp from "sharp";

test("local storyboard lets an owner substitute a missed moment and restore defaults", async ({ page, accounts }) => {
  const owner = await accounts.create();
  await login(page, owner);
  await page.goto("/experiments/gif");
  const frames = await Promise.all(Array.from({ length: 12 }, (_, i) => sharp({ create: { width: 32, height: 32, channels: 3, background: {r: i*20, g:50, b:100} } }).png().toBuffer()));
  const bytes = await sharp(frames, {join:{animated:true}}).gif({delay:Array(12).fill(100),loop:0}).toBuffer();
  await page.getByLabel("GIF to review").setInputFiles({name:"review.gif",mimeType:"image/gif",buffer:bytes});
  await expect(page.getByRole("button",{name:"Select storyboard frame 1",exact:true})).toBeVisible();
  await page.getByRole("button",{name:"Use these frames",exact:true}).click();
  await expect(page.getByRole("status")).toContainText("Frames confirmed for this local preview");
  await page.getByRole("button",{name:"Select storyboard frame 2",exact:true}).click();
  await page.getByText("Adjust frames",{exact:true}).click();
  await expect(page.getByLabel("Browse moments")).toHaveValue("1");
  await page.getByRole("button",{name:"Select storyboard frame 1",exact:true}).click();
  await expect(page.getByLabel("Browse moments")).toHaveValue("0");
  // Eight time samples omit frame 3 in this 12-frame animation.
  await page.getByLabel("Browse moments").fill("2");
  await page.getByRole("button",{name:"Replace selected frame",exact:true}).click();
  await expect(page.getByRole("button",{name:"Select storyboard frame 3",exact:true})).toBeVisible();
  await expect(page.getByRole("button",{name:"Select storyboard frame 1",exact:true})).toHaveCount(0);
  await expect(page.getByRole("status")).toContainText("Selection changed");
  await page.getByRole("button",{name:"Reset automatic selection"}).click();
  await expect(page.getByRole("button",{name:"Select storyboard frame 1",exact:true})).toBeVisible();
});
