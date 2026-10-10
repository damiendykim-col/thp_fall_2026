/** @jest-environment node */
jest.mock("server-only", () => ({}), { virtual: true });
import sharp from "sharp";
import { imageParts } from "./media";

test("GIF generation receives the confirmed frame order and timing, never GIF bytes labeled JPEG", async () => {
  const frames = await Promise.all(["red","green","blue"].map(background => sharp({create:{width:16,height:16,channels:3,background}}).png().toBuffer()));
  const gif = await sharp(frames,{join:{animated:true}}).gif({delay:[100,200,300]}).toBuffer();
  const parts = await imageParts(gif,[0,2]);
  const images = parts.filter(p => "inlineData" in p);
  expect(images).toHaveLength(2);
  expect(JSON.stringify(parts)).toContain("0.300s");
  for (const part of images) expect((await sharp(Buffer.from(part.inlineData!.data,"base64")).metadata()).format).toBe("jpeg");
});
test("rejects duplicate and out-of-range selection", async () => {
  const gif=await sharp({create:{width:16,height:16,channels:3,background:"red"}}).gif().toBuffer();
  await expect(imageParts(gif,[0,0])).rejects.toThrow();
  await expect(imageParts(gif,[1])).rejects.toThrow();
});
