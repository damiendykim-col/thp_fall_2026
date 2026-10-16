import { render, screen } from "@testing-library/react";
import { ArrivalEmpty, ReturnVisits, RoundResults } from "./arrival";
import type { Challenge } from "@/lib/challenges/types";

const round: Challenge & { imageUrl: string | null } = { id: "r1", own: false, status: "published", situation: "A scene", image_path: null, template_url: null, closes_at: "2026-01-01T00:00:00Z", closed: true, vote: null, imageUrl: null, captions: [{ id: "h", body: "Human line", origin: "human", votes: 0 }, { id: "a", body: "AI line", origin: "ai", votes: 0 }] };
test("a first visit has a useful action and an explicitly illustrative example, not an empty results loop", () => {
  render(<ArrivalEmpty />);
  expect(screen.getByRole("link", { name: "Start a challenge" })).toHaveAttribute("href", "/challenges/new");
  expect(screen.queryByRole("link", { name: "Explore results" })).not.toBeInTheDocument();
  expect(screen.getByText("Illustrative captions. No votes are recorded.")).toBeInTheDocument();
  expect(screen.queryByText(/Sign in to vote/)).not.toBeInTheDocument();
});
test("empty open feed prioritizes resuming a saved draft", () => {
  render(<ArrivalEmpty draft={{ id: "draft", status: "ready" }} />);
  expect(screen.getByRole("link", { name: "Resume your draft" })).toHaveAttribute("href", "/challenges/draft");
});
test("return visits link only the supplied recent rounds without inventing unread state", () => {
  render(<ReturnVisits recent={[{ id: "r1", closes_at: "2026-01-01T00:00:00Z", joke_context: null }]} draft={null} error={false} />);
  expect(screen.queryByRole("heading", { name: "Your recent results" })).not.toBeInTheDocument();
  expect(screen.getByRole("link", { name: /Recent results/ })).toHaveAttribute("href", "/challenges?view=results");
  expect(screen.queryByText(/new results/i)).not.toBeInTheDocument();
});
test.each([[0, 0, "No votes this round"], [1, 1, "It’s a tie"], [2, 1, "Human caption wins"], [1, 2, "AI caption wins"]])("results show %s:%s as %s", (human, ai, label) => {
  render(<RoundResults rounds={[{ ...round, captions: round.captions.map((c, i) => ({ ...c, votes: Number(i ? ai : human) })) }]} />);
  expect(screen.getByText(String(label))).toBeVisible();
  expect(screen.getByText("Human line")).toBeVisible();
  expect(screen.getByText("AI line")).toBeVisible();
  expect(screen.getByRole("link", { name: "View full results" })).toHaveAttribute("href", "/challenges/r1");
});
test("an unclosed RPC response never reveals attribution or counts", () => {
  render(<RoundResults rounds={[{ ...round, closed: false }]} />);
  expect(screen.queryByText("Human line")).not.toBeInTheDocument();
  expect(screen.queryByText("AI line")).not.toBeInTheDocument();
});
