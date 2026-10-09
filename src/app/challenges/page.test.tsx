import { render, screen, within } from "@testing-library/react";
import ChallengesPage from "./page";
import { createAuthClient } from "@/lib/supabase/server";

jest.mock("@/lib/supabase/server", () => ({ createAuthClient: jest.fn() }));
jest.mock("@/components/site-header", () => ({ __esModule: true, default: () => null }));
jest.mock("@/lib/challenges/winners", () => ({ getChallengeWinners: jest.fn() }));

const rows = [
  { id: "own", creator_id: "viewer" },
  { id: "voted", creator_id: "other" },
  { id: "fresh-new", creator_id: "other" },
  { id: "fresh-old", creator_id: "other" },
].map(row => ({ ...row, status: "published", situation: row.id, template_url: "/example.png", closes_at: "2099-01-01T00:00:00Z" }));
function setup(votes = [{ challenge_id: "voted" }], voteError: object | null = null) {
  const from = jest.fn((table: string) => {
    const result = table === "challenges" ? { data: rows, error: null } : { data: votes, error: voteError };
    const chain = { ...result, select: jest.fn(), eq: jest.fn(), is: jest.fn(), gt: jest.fn(), order: jest.fn(), limit: jest.fn(), in: jest.fn() };
    for (const method of [chain.select, chain.eq, chain.is, chain.gt, chain.order, chain.limit, chain.in]) method.mockReturnValue(chain);
    return chain;
  });
  jest.mocked(createAuthClient).mockResolvedValue({ auth: { getUser: async () => ({ data: { user: { id: "viewer" } }, error: null }) }, from } as never);
}
test("open feed prioritizes unvoted rounds, keeps voted rounds accessible and labels ownership", async () => {
  setup();
  render(await ChallengesPage({ searchParams: Promise.resolve({}) }));
  const cards = screen.getAllByRole("listitem");
  expect(cards.map(card => within(card).getByRole("link").getAttribute("href"))).toEqual([
    "/challenges/fresh-new", "/challenges/fresh-old", "/challenges/voted", "/challenges/own",
  ]);
  expect(within(cards[2]).getByText("Voted")).toBeVisible();
  expect(within(cards[2]).getByText(/Review your vote/)).toBeVisible();
  expect(within(cards[3]).getByText("Yours")).toBeVisible();
  expect(within(cards[3]).getByText(/View your challenge/)).toBeVisible();
});
test("undoing a vote removes its badge on the next feed load", async () => {
  setup([]);
  render(await ChallengesPage({ searchParams: Promise.resolve({}) }));
  expect(screen.queryByText("Voted")).not.toBeInTheDocument();
  expect(screen.getAllByRole("listitem")[0]).toHaveTextContent("Pick the funnier caption");
});
test("vote lookup failure does not silently label voted rounds as unvoted", async () => {
  setup([], { message: "unavailable" });
  render(await ChallengesPage({ searchParams: Promise.resolve({}) }));
  expect(screen.getByRole("alert")).toHaveTextContent("couldn’t be loaded");
  expect(screen.queryByRole("listitem")).not.toBeInTheDocument();
});
