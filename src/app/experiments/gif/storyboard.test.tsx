import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import GifStoryboard from "./storyboard";
import { inspectGif } from "./actions";
jest.mock("./actions", () => ({ inspectGif: jest.fn() }));
beforeEach(() => {
  URL.createObjectURL = jest.fn(() => "blob:gif"); URL.revokeObjectURL = jest.fn();
  jest.mocked(inspectGif).mockResolvedValue({ storyboard: { durationMs: 900, selected: [0,1,2,3,4,5,6,8], frames: Array.from({length:9}, (_,i) => ({ index:i, startMs:i*100, durationMs:100, src:`data:image/jpeg;base64,${i}` })) } });
});
test("lets the owner replace an automatic selection, preserves chronology, and resets", async () => {
  render(<GifStoryboard />);
  fireEvent.change(screen.getByLabelText("GIF to review"), {target:{files:[new File(["gif"],"test.gif")]}});
  await screen.findByRole("button", {name:"Select storyboard frame 1"});
  fireEvent.click(screen.getByRole("button", {name:"Select storyboard frame 2"}));
  expect(screen.getByLabelText("Browse moments")).toHaveValue("1");
  fireEvent.click(screen.getByText("Adjust frames"));
  fireEvent.change(screen.getByLabelText("Browse moments"), {target:{value:"7"}});
  fireEvent.click(screen.getByRole("button", {name:"Replace selected frame"}));
  await waitFor(() => expect(screen.queryByRole("button", {name:"Select storyboard frame 2"})).not.toBeInTheDocument());
  expect(screen.getByRole("button", {name:"Select storyboard frame 8"})).toBeVisible();
  expect(screen.getByText(/selection changed/i)).toBeVisible();
  fireEvent.click(screen.getByRole("button", {name:"Reset automatic selection"}));
  expect(screen.getByRole("button", {name:"Select storyboard frame 2"})).toBeVisible();
});

test("automatic frames can be accepted immediately and edits require confirmation again", async () => {
  render(<GifStoryboard />);
  fireEvent.change(screen.getByLabelText("GIF to review"), {target:{files:[new File(["gif"],"test.gif")]}});
  const accept = await screen.findByRole("button", {name:"Use these frames"});
  expect(accept).toBeEnabled();
  expect(screen.getByText("Adjust frames").closest("details")).not.toHaveAttribute("open");
  fireEvent.click(accept);
  expect(screen.getByText(/Frames confirmed for this local preview/)).toBeVisible();
  fireEvent.click(screen.getByRole("button", {name:"Select storyboard frame 2"}));
  expect(screen.getByLabelText("Browse moments")).toHaveValue("1");
  expect(screen.getByText(/Frames confirmed for this local preview/)).toBeVisible();
  fireEvent.click(screen.getByText("Adjust frames"));
  fireEvent.change(screen.getByLabelText("Browse moments"), {target:{value:"7"}});
  fireEvent.click(screen.getByRole("button", {name:"Replace selected frame"}));
  expect(screen.queryByText(/Frames confirmed for this local preview/)).not.toBeInTheDocument();
  expect(screen.getByRole("button", {name:"Use these frames"})).toBeEnabled();
});
