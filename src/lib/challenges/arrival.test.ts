jest.mock("server-only", () => ({}));
import { getRoundResults, getReturnVisits, resultsPage } from "./arrival";
import type { SupabaseClient } from "@supabase/supabase-js";

function query(result: object) {
  const chain = { ...result, select: jest.fn(), eq: jest.fn(), is: jest.fn(), in: jest.fn(), lte: jest.fn(), order: jest.fn(), limit: jest.fn(), range: jest.fn() };
  for (const value of Object.values(chain)) if (jest.isMockFunction(value)) value.mockReturnValue(chain);
  return chain;
}
test("return summaries merge and deduplicate the user's most recent owned and voted rounds", async () => {
  const older = { id: "older", closes_at: "2026-01-01", joke_context: null };
  const newest = { id: "newest", closes_at: "2026-10-01", joke_context: null };
  const drafts = query({ data: [{ id: "draft", status: "ready" }], error: null });
  const own = query({ data: [older, newest], error: null });
  const votes = query({ data: [{ round: newest }], error: null });
  const from = jest.fn().mockReturnValueOnce(drafts).mockReturnValueOnce(own).mockReturnValueOnce(votes);
  const data = await getReturnVisits({ from } as unknown as SupabaseClient, "viewer");
  expect(data).toEqual({ draft: { id: "draft", status: "ready" }, recent: [newest, older], error: false });
  expect(drafts.eq).toHaveBeenCalledWith("creator_id", "viewer");
  expect(votes.eq).toHaveBeenCalledWith("user_id", "viewer");
  expect(votes.is).toHaveBeenCalledWith("round.hidden_at", null);
  expect(votes.limit).toHaveBeenCalledWith(3);
});
test("activity errors remain explicit while successfully loaded information is kept", async () => {
  const from = jest.fn().mockReturnValueOnce(query({ data: [{ id: "d", status: "draft" }], error: null }))
    .mockReturnValue(query({ data: null, error: { message: "offline" } }));
  const data = await getReturnVisits({ from } as unknown as SupabaseClient, "viewer");
  expect(data.error).toBe(true);
  expect(data.draft?.id).toBe("d");
  expect(data.recent).toEqual([]);
});
test.each([undefined, "0", "-1", "1.5", "NaN", "10001"])("invalid result page %s resets to page 1", value => {
  expect(resultsPage(value)).toBe(1);
});
test("result reads are bounded, and rows still open or newly hidden are suppressed", async () => {
  const chain = query({ data: Array.from({ length: 13 }, (_, i) => ({ id: String(i) })), error: null });
  const rpc = jest.fn().mockResolvedValue({ data: { status: "published", closed: false, captions: [{ origin: "human", body: "Never render" }] }, error: null });
  const result = await getRoundResults({ from: () => chain, rpc } as unknown as SupabaseClient, 2);
  expect(chain.range).toHaveBeenCalledWith(12, 24);
  expect(rpc).toHaveBeenCalledTimes(12);
  expect(result).toEqual({ rounds: [], more: true });
});
test("result query errors are not presented as empty rounds", async () => {
  await expect(getRoundResults({ from: () => query({ data: null, error: { message: "offline" } }) } as unknown as SupabaseClient, 1)).rejects.toThrow("couldn’t be loaded");
});
