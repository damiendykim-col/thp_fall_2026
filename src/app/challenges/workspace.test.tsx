import { fireEvent, render, screen } from "@testing-library/react";
import ChallengeWorkspace from "./workspace";
let params = new URLSearchParams("mode=create");
jest.mock("next/navigation", () => ({ useSearchParams: () => params }));
test("switching panels retains unfinished creation inputs and follows browser navigation", () => {
  const panels = { create: <input aria-label="Caption draft" defaultValue="" />, browse: <p>Open rounds</p> };
  const view = render(<ChallengeWorkspace {...panels} />);
  expect(screen.getByRole("button", { name: "Create" })).toHaveAttribute("aria-pressed", "true");
  fireEvent.change(screen.getByLabelText("Caption draft"), { target: { value: "Keep this" } });
  fireEvent.click(screen.getByRole("button", { name: "Browse" }));
  params = new URLSearchParams(window.location.search);
  view.rerender(<ChallengeWorkspace {...panels} />);
  expect(screen.getByText("Open rounds")).toBeVisible();
  expect(screen.getByLabelText("Caption draft")).not.toBeVisible();
  params = new URLSearchParams("mode=create");
  view.rerender(<ChallengeWorkspace {...panels} />);
  expect(screen.getByLabelText("Caption draft")).toBeVisible();
  expect(screen.getByLabelText("Caption draft")).toHaveValue("Keep this");
});
