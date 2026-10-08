/** @jest-environment node */
jest.mock("server-only", () => ({}), { virtual: true });
import { classifyContent, validateModeration, MODERATION_POLICY } from "./moderation";

afterEach(() => jest.restoreAllMocks());
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
