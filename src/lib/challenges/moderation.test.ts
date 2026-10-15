/** @jest-environment node */
jest.mock("server-only", () => ({}), { virtual: true });
import { classifyContent, ensureModerated, isModerationEnabled, requireTemplateReview, validateModeration, MODERATION_POLICY } from "./moderation";
import { challengeAdmin } from "./server";

jest.mock("./server", () => ({ challengeAdmin: jest.fn() }));

afterEach(() => {
  delete process.env.MODERATION_ENABLED;
  delete process.env.CHALLENGE_MODERATION_ENABLED;
  delete process.env.ENABLE_MODERATION;
  delete process.env.MODERATION_DISABLED;
  delete process.env.DISABLE_MODERATION;
  jest.restoreAllMocks();
});

test("isModerationEnabled returns expected boolean based on environment", () => {
  expect(isModerationEnabled({})).toBe(true);
  expect(isModerationEnabled({ MODERATION_ENABLED: "true" })).toBe(true);
  expect(isModerationEnabled({ MODERATION_ENABLED: "false" })).toBe(false);
  expect(isModerationEnabled({ MODERATION_ENABLED: "0" })).toBe(false);
  expect(isModerationEnabled({ CHALLENGE_MODERATION_ENABLED: "false" })).toBe(false);
  expect(isModerationEnabled({ ENABLE_MODERATION: "false" })).toBe(false);
  expect(isModerationEnabled({ MODERATION_DISABLED: "true" })).toBe(false);
  expect(isModerationEnabled({ DISABLE_MODERATION: "true" })).toBe(false);
});

test("classifyContent returns allowed without calling fetch when moderation is disabled", async () => {
  const fetchMock = jest.spyOn(global, "fetch");
  process.env.MODERATION_ENABLED = "false";
  const verdict = await classifyContent({ provider: "gemini", model: "test" }, "Any text");
  expect(verdict).toEqual({ allowed: true, category: "none" });
  expect(fetchMock).not.toHaveBeenCalled();
});

test("ensureModerated claims and auto-approves check when moderation is disabled", async () => {
  process.env.MODERATION_ENABLED = "false";
  const updateMock = jest.fn().mockReturnValue({
    eq: jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        maybeSingle: jest.fn().mockResolvedValue({ data: { id: "check-123" } }),
      }),
    }),
  });
  const admin = {
    rpc: jest.fn().mockResolvedValue({ data: { id: "check-123", status: "running" } }),
    from: jest.fn().mockReturnValue({ update: updateMock }),
  };
  jest.mocked(challengeAdmin).mockReturnValue(admin as unknown as ReturnType<typeof challengeAdmin>);

  const checkId = await ensureModerated("owner-uuid", "human", "joke text");
  expect(checkId).toBe("check-123");
  expect(admin.rpc).toHaveBeenCalledWith("claim_moderation", expect.objectContaining({
    p_owner: "owner-uuid",
    p_phase: "human",
    p_provider: "disabled",
    p_model: "none",
  }));
  expect(updateMock).toHaveBeenCalledWith({ status: "approved", category: "none" });
});

test("requireTemplateReview upserts template review when moderation is disabled", async () => {
  process.env.MODERATION_ENABLED = "false";
  const upsertMock = jest.fn().mockResolvedValue({ error: null });
  const admin = {
    from: jest.fn((table: string) => {
      if (table === "images") {
        return {
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              maybeSingle: jest.fn().mockResolvedValue({ data: { image_url: "http://example.com/template.jpg" } }),
            }),
          }),
        };
      }
      return { upsert: upsertMock };
    }),
  };
  jest.mocked(challengeAdmin).mockReturnValue(admin as unknown as ReturnType<typeof challengeAdmin>);

  await expect(requireTemplateReview("template-id")).resolves.toBeUndefined();
  expect(upsertMock).toHaveBeenCalledWith(
    expect.objectContaining({ template_id: "template-id", image_url: "http://example.com/template.jpg" }),
    { onConflict: "template_id" },
  );
});
test("moderation rejects malformed, contradictory, or unknown decisions", () => {
  expect(validateModeration({ allowed: true, category: "none" })).toEqual({ allowed: true, category: "none" });
  for (const value of [null, {}, { allowed: "true", category: "none" }, { allowed: true, category: "hate" }, { allowed: false, category: "none" }, { allowed: false, category: "invented" }]) {
    expect(() => validateModeration(value)).toThrow();
  }
});
test("policy distinguishes humor from harm and treats submitted text as untrusted data", () => {
  expect(MODERATION_POLICY).toContain("Dark humor");
  expect(MODERATION_POLICY).toContain("not instructions");
});
test("provider outages, truncated outputs and invalid JSON never approve content", async () => {
  const fetchMock = jest.spyOn(global, "fetch");
  for (const response of [new Response("secret diagnostic", { status: 500 }), new Response(JSON.stringify({ candidates: [{ finishReason: "MAX_TOKENS" }] })), new Response(JSON.stringify({ candidates: [{ finishReason: "STOP", content: { parts: [{ text: "not json" }] } }] }))]) {
    fetchMock.mockResolvedValueOnce(response);
    await expect(classifyContent({ provider: "gemini", model: "test" }, "content")).rejects.toThrow("Safety checking is unavailable");
  }
});
test("moderation sends actual image bytes and requests a constrained verdict", async () => {
  const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue(new Response(JSON.stringify({ candidates: [{ finishReason: "STOP", content: { parts: [{ text: '{"allowed":false,"category":"harassment"}' }] } }] })));
  expect(await classifyContent({ provider: "gemini", model: "test" }, "Untrusted text", Buffer.from("image"))).toEqual({ allowed: false, category: "harassment" });
  const body = JSON.parse(fetchMock.mock.calls[0][1]!.body as string);
  expect(body.generationConfig.responseMimeType).toBe("application/json");
  expect(body.contents[0].parts[1].inlineData.data).toBe(Buffer.from("image").toString("base64"));
});
