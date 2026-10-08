import { render, screen } from "@testing-library/react";
import Winners from "./winners";

test("a winning caption has attribution and a link to its original challenge", () => {
  render(<Winners winners={[{challenge_id:"c1",caption_id:"x",caption:"A winning line",origin:"ai",upvotes:2,closes_at:"2026-10-07T00:00:00Z",situation:"A scene",image_path:null,template_url:"https://example.com/image.jpg",imageUrl:"https://example.com/image.jpg"}]} />);
  expect(screen.getByText("A winning line")).toBeInTheDocument();
  expect(screen.getByText("AI-generated")).toBeInTheDocument();
  expect(screen.getByRole("link",{name:"View results"})).toHaveAttribute("href","/challenges/c1");
  expect(screen.getByText("Challenge winner")).toBeInTheDocument();
});
test("empty winners invite participation rather than showing templates as winners", () => {
  render(<Winners winners={[]} />);
  expect(screen.getByText("No winners yet.")).toBeInTheDocument();
  expect(screen.getByRole("link",{name:"Browse challenges"})).toHaveAttribute("href","/challenges");
});
