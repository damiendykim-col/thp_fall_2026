/** @jest-environment node */
import type { SupabaseClient } from "@supabase/supabase-js";
import { signAvatars } from "./avatars";

const sign = jest.fn();
const client = { storage: { from: () => ({ createSignedUrls: sign }) } } as unknown as SupabaseClient;
beforeEach(() => jest.clearAllMocks());

it("avoids requests for absent photos", async () => {
  expect((await signAvatars(client, [null], "profile.avatars")).size).toBe(0);
  expect(sign).not.toHaveBeenCalled();
});

it("deduplicates paths and keeps successful photos when another is denied", async () => {
  sign.mockResolvedValue({ data: [
    { path: "owner/old.gif", error: "denied", signedUrl: null },
    { path: "owner/current.gif", error: null, signedUrl: "https://example.com/current" },
  ], error: null });
  const log = jest.spyOn(console, "error").mockImplementation(() => {});
  try {
    const result = await signAvatars(client, ["owner/current.gif", "owner/old.gif", "owner/current.gif", null], "profile.avatars");
    expect(sign).toHaveBeenCalledWith(["owner/current.gif", "owner/old.gif"], 3600);
    expect([...result]).toEqual([["owner/current.gif", "https://example.com/current"]]);
    expect(log).toHaveBeenCalledWith("Avatar signing failed for one or more photos");
  } finally { log.mockRestore(); }
});

it("does not reuse private signed URLs between calls", async () => {
  sign.mockResolvedValueOnce({ data: [{ path: "owner/current.gif", signedUrl: "https://example.com/first", error: null }], error: null })
    .mockResolvedValueOnce({ data: [], error: null });
  const log = jest.spyOn(console, "error").mockImplementation(() => {});
  try {
    await signAvatars(client, ["owner/current.gif"], "members.avatars");
    expect((await signAvatars(client, ["owner/current.gif"], "members.avatars")).size).toBe(0);
    expect(sign).toHaveBeenCalledTimes(2);
  } finally { log.mockRestore(); }
});
