/** @jest-environment node */
jest.mock("server-only", () => ({}), { virtual: true });
jest.mock("@/lib/auth", () => ({ requireUser: jest.fn() }));
jest.mock("@/lib/challenges/server", () => ({ challengeAdmin: jest.fn(), normalizeChallengeImage: jest.fn() }));
jest.mock("@/lib/challenges/generation", () => ({
  ...jest.requireActual("@/lib/challenges/generation"),
  generateDescription: jest.fn(), generationConfig: jest.fn(),
}));
import { requireUser } from "@/lib/auth";
import { challengeAdmin } from "@/lib/challenges/server";
import { generateDescription, generationConfig } from "@/lib/challenges/generation";
import { suggestImageDescription } from "./image-actions";

const image = { id: "image-1", upload_ready: true, storage_path: "owner/image.jpg", description_status: "pending" };
function setup(row: object | null = image) {
  const query = {
    select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), is: jest.fn().mockReturnThis(),
    in: jest.fn().mockReturnThis(), update: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue({ data: row }),
    maybeSingle: jest.fn().mockResolvedValue({ data: { id: "image-1" } }),
  };
  const download = jest.fn().mockResolvedValue({ data: new Blob(["image"]) });
  const admin = { rpc: jest.fn().mockResolvedValue({ data: true }), from: jest.fn(() => query), storage: { from: jest.fn(() => ({ download })) } };
  jest.mocked(requireUser).mockResolvedValue({ user: { id: "owner" } } as Awaited<ReturnType<typeof requireUser>>);
  jest.mocked(challengeAdmin).mockReturnValue(admin as unknown as ReturnType<typeof challengeAdmin>);
  jest.mocked(generationConfig).mockReturnValue({ provider: "gemini", model: "test" });
  return { query, download };
}
beforeEach(() => jest.clearAllMocks());
test("description failure preserves the uploaded image for manual confirmation", async () => {
  const { query } = setup();
  jest.mocked(generateDescription).mockRejectedValue(new Error("private provider diagnostic"));
  const result = await suggestImageDescription("image-1");
  expect(result).toEqual({ id: "image-1", error: "A description could not be suggested. Write your own to continue." });
  expect(query.eq).toHaveBeenCalledWith("owner_id", "owner");
  expect(query.update).toHaveBeenCalledWith({ description_status: "failed" });
});
test("cached suggestions are reused without downloading or calling the provider", async () => {
  const { download } = setup({ ...image, description_status: "succeeded", suggested_description: "A square." });
  expect(await suggestImageDescription("image-1")).toEqual({ id: "image-1", description: "A square." });
  expect(download).not.toHaveBeenCalled();
  expect(generateDescription).not.toHaveBeenCalled();
});
test("an unavailable or other-owner image never reaches the provider", async () => {
  const { query } = setup(null);
  expect(await suggestImageDescription("another-image")).toEqual({ error: "Image unavailable." });
  expect(query.eq).toHaveBeenCalledWith("owner_id", "owner");
  expect(generateDescription).not.toHaveBeenCalled();
});
test("only the request that claims analysis can invoke the model", async () => {
  const { query } = setup();
  query.maybeSingle.mockResolvedValue({ data: null });
  expect((await suggestImageDescription("image-1")).id).toBeUndefined();
  expect(generateDescription).not.toHaveBeenCalled();
});

test("an image without safety approval cannot use manual description fallback", async () => {
  setup({ ...image, description_status: "failed" });
  const admin = jest.mocked(challengeAdmin)();
  jest.mocked(admin.rpc).mockResolvedValueOnce({ data: false } as unknown as Awaited<ReturnType<typeof admin.rpc>>);
  const result = await suggestImageDescription("image-1");
  expect(result.id).toBeUndefined();
  expect(result.error).toContain("must pass safety");
  expect(generateDescription).not.toHaveBeenCalled();
});
