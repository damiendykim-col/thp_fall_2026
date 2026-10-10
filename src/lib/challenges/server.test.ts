/** @jest-environment node */
jest.mock("server-only", () => ({}), { virtual: true });
import sharp from "sharp";
import { normalizeChallengeImage } from "./server";

test("accepts a valid image exactly at the 3 MiB upload boundary", async () => {
  const jpeg = await sharp({ create: { width: 16, height: 16, channels: 3, background: "yellow" } }).jpeg().toBuffer();
  const padded = Buffer.concat([jpeg, Buffer.alloc(3 * 1024 * 1024 - jpeg.length)]);
  const output = await normalizeChallengeImage(new File([padded], "boundary.jpg", { type: "image/jpeg" }));
  expect((await sharp(output).metadata()).format).toBe("jpeg");
});
test("rejects files one byte above 3 MiB before decoding", async () => {
  await expect(normalizeChallengeImage(new File([new Uint8Array(3 * 1024 * 1024 + 1)], "large.jpg"))).rejects.toThrow("up to 3 MB");
});
