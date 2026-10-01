/** @jest-environment node */
import { requireUser, requireCompleteProfile } from "./auth";
import { createAuthClient } from "./supabase/server";

jest.mock("./supabase/server", () => ({ createAuthClient: jest.fn() }));
jest.mock("next/navigation", () => ({ redirect: (path: string) => { throw new Error(`redirect:${path}`); } }));
const createClient = jest.mocked(createAuthClient);

function client(user: { id: string } | null, profile: unknown = null) {
  const maybeSingle = jest.fn().mockResolvedValue({ data: profile, error: null });
  const eq = jest.fn().mockReturnValue({ maybeSingle });
  const from = jest.fn().mockReturnValue({ select: jest.fn().mockReturnValue({ eq }) });
  const value = { auth: { getUser: jest.fn().mockResolvedValue({ data: { user }, error: null }) }, from };
  createClient.mockResolvedValue(value as unknown as Awaited<ReturnType<typeof createAuthClient>>);
  return { eq, from };
}

it("redirects anonymous requests before querying private data", async () => {
  const { from } = client(null);
  await expect(requireUser()).rejects.toThrow("redirect:/login");
  expect(from).not.toHaveBeenCalled();
});
it("gates members when a name is missing", async () => {
  client({ id: "user-1" }, { first_name: "Ada", last_name: null });
  await expect(requireCompleteProfile()).rejects.toThrow("redirect:/profile");
});
it("loads only the verified user's complete profile", async () => {
  const profile = { id: "user-1", first_name: "Ada", last_name: "Lovelace", avatar_path: null };
  const { eq } = client({ id: "user-1" }, profile);
  await expect(requireCompleteProfile()).resolves.toMatchObject({ profile });
  expect(eq).toHaveBeenCalledWith("id", "user-1");
});
