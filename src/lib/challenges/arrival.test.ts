jest.mock("server-only", () => ({}));
import { getRoundResults, getReturnVisits, resultsPage } from "./arrival";
import type { SupabaseClient } from "@supabase/supabase-js";

function query(result: object) {
  const chain = { ...result, select: jest.fn(), eq: jest.fn(), is: jest.fn(), in: jest.fn(), lte: jest.fn(), order: jest.fn(), limit: jest.fn(), range: jest.fn() };
  for (const value of Object.values(chain)) if (jest.isMockFunction(value)) value.mockReturnValue(chain);
  return chain;
}
test("return visits fetch only the viewer's active drafts", async () => {
  const drafts = query({ data: [{ id: "draft", status: "ready" }], error: null });
  const from = jest.fn().mockReturnValue(drafts);
  const data = await getReturnVisits({ from } as unknown as SupabaseClient, "viewer");
  expect(data).toEqual({ drafts: [{ id: "draft", status: "ready" }], draft: { id: "draft", status: "ready" }, error: false });
  expect(from).toHaveBeenCalledTimes(1);
  expect(drafts.eq).toHaveBeenCalledWith("creator_id", "viewer");
  expect(drafts.limit).toHaveBeenCalledWith(3);
});
test("draft load failures remain explicit", async () => {
  const from = jest.fn().mockReturnValue(query({ data: null, error: { message: "offline" } }));
  const data = await getReturnVisits({ from } as unknown as SupabaseClient, "viewer");
  expect(data).toEqual({ drafts: [], draft: null, error: true });
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
