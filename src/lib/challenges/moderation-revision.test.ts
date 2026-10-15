/** @jest-environment node */
jest.mock("server-only", () => ({}), { virtual: true });
jest.mock("./server", () => ({ challengeAdmin: jest.fn() }));
jest.mock("./generation", () => ({ generationConfig: () => ({ provider: "mock", model: "test" }) }));
import { challengeAdmin } from "./server";
import { reviewChallenge } from "./moderation";

test.each([false, true])("a moderation result attaches only to the revision it inspected (changed=%s)", async changed => {
  const challenge = { id: "c", creator_id: "u", revision: 4, template_id: "t", template_url: "url", image_description: "Scene", joke_context: "Context" };
  const writes = { eq: jest.fn().mockReturnThis(), is: jest.fn().mockReturnThis(), select: jest.fn().mockReturnThis(), maybeSingle: jest.fn().mockResolvedValue({ data: changed ? null : { id: "c" } }) };
  const query = (data: unknown) => ({ eq: jest.fn().mockReturnThis(), single: jest.fn().mockResolvedValue({ data }), maybeSingle: jest.fn().mockResolvedValue({ data }) });
  const admin = {
    from: jest.fn((table: string) => {
      if (table === "challenges") return { select: () => query(challenge), update: () => writes };
      if (table === "challenge_captions") return { select: () => ({ eq: async () => ({ data: [{ body: "Human joke", origin: "human" }] }) }) };
      return { select: () => query({ template_id: "t", image_url: "url" }) };
    }),
    rpc: jest.fn().mockResolvedValue({ data: { id: "approval", status: "approved", claimed: false } }),
  };
  jest.mocked(challengeAdmin).mockReturnValue(admin as unknown as ReturnType<typeof challengeAdmin>);
  const review = reviewChallenge("u", "c", false);
  if (changed) await expect(review).rejects.toThrow("changed during safety review");
  else await expect(review).resolves.toMatchObject({ challenge });
  expect(writes.eq).toHaveBeenCalledWith("revision", 4);
});

test("a moderation result attaches without a revision filter when revision is undefined", async () => {
  const challenge = { id: "c-no-rev", creator_id: "u", template_id: "t", template_url: "url", image_description: "Scene", joke_context: "Context" };
  const writes = { eq: jest.fn().mockReturnThis(), is: jest.fn().mockReturnThis(), select: jest.fn().mockReturnThis(), maybeSingle: jest.fn().mockResolvedValue({ data: { id: "c-no-rev" } }) };
  const query = (data: unknown) => ({ eq: jest.fn().mockReturnThis(), single: jest.fn().mockResolvedValue({ data }), maybeSingle: jest.fn().mockResolvedValue({ data }) });
  const admin = {
    from: jest.fn((table: string) => {
      if (table === "challenges") return { select: () => query(challenge), update: () => writes };
      if (table === "challenge_captions") return { select: () => ({ eq: async () => ({ data: [{ body: "Human joke", origin: "human" }] }) }) };
      return { select: () => query({ template_id: "t", image_url: "url" }) };
    }),
    rpc: jest.fn().mockResolvedValue({ data: { id: "approval", status: "approved", claimed: false } }),
  };
  jest.mocked(challengeAdmin).mockReturnValue(admin as unknown as ReturnType<typeof challengeAdmin>);
  const result = await reviewChallenge("u", "c-no-rev", false);
  expect(result).toMatchObject({ challenge });
  expect(writes.eq).toHaveBeenCalledWith("id", "c-no-rev");
  expect(writes.eq).toHaveBeenCalledWith("creator_id", "u");
  expect(writes.eq).not.toHaveBeenCalledWith("revision", expect.anything());
});

test("reviewChallenge throws when the challenge update fails with a database error", async () => {
  const challenge = { id: "c-err", creator_id: "u", revision: 1, template_id: "t", template_url: "url", image_description: "Scene", joke_context: "Context" };
  const writes = { eq: jest.fn().mockReturnThis(), is: jest.fn().mockReturnThis(), select: jest.fn().mockReturnThis(), maybeSingle: jest.fn().mockResolvedValue({ data: null, error: new Error("DB Error") } as any) };
  const query = (data: unknown) => ({ eq: jest.fn().mockReturnThis(), single: jest.fn().mockResolvedValue({ data }), maybeSingle: jest.fn().mockResolvedValue({ data }) });
  const admin = {
    from: jest.fn((table: string) => {
      if (table === "challenges") return { select: () => query(challenge), update: () => writes };
      if (table === "challenge_captions") return { select: () => ({ eq: async () => ({ data: [{ body: "Human joke", origin: "human" }] }) }) };
      return { select: () => query({ template_id: "t", image_url: "url" }) };
    }),
    rpc: jest.fn().mockResolvedValue({ data: { id: "approval", status: "approved", claimed: false } }),
  };
  jest.mocked(challengeAdmin).mockReturnValue(admin as unknown as ReturnType<typeof challengeAdmin>);
  await expect(reviewChallenge("u", "c-err", false)).rejects.toThrow("Safety checking is unavailable");
});
