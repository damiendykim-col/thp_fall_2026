import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import ChallengeForm from "./challenge-form";
import { uploadChallengeImage, suggestImageDescription } from "../image-actions";

jest.mock("next/navigation", () => ({ useRouter: () => ({ push: jest.fn() }) }));
jest.mock("../actions", () => ({ createChallenge: jest.fn() }));
jest.mock("../image-actions", () => ({ uploadChallengeImage: jest.fn(), suggestImageDescription: jest.fn() }));
beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(uploadChallengeImage).mockResolvedValue({ id: "image-1" });
  jest.mocked(suggestImageDescription).mockResolvedValue({ id: "image-1", description: "A yellow square." });
  URL.createObjectURL = jest.fn(() => "blob:preview");
  URL.revokeObjectURL = jest.fn();
});
function upload() {
  fireEvent.change(screen.getByLabelText(/Challenge image/), { target: { files: [new File(["image"], "test.png", { type: "image/png" })] } });
}
test("a suggestion needs explicit confirmation, and editing invalidates confirmation", async () => {
  render(<ChallengeForm templates={[]} />);
  upload();
  await waitFor(() => expect(screen.getByLabelText("Image description")).toHaveValue("A yellow square."));
  fireEvent.change(screen.getByLabelText("Your caption"), { target: { value: "My joke." } });
  expect(screen.getByRole("button", { name: "Create draft" })).toBeDisabled();
  fireEvent.click(screen.getByLabelText("I confirm this image description"));
  expect(screen.getByRole("button", { name: "Create draft" })).toBeEnabled();
  fireEvent.change(screen.getByLabelText("Image description"), { target: { value: "A yellow rectangle." } });
  expect(screen.getByLabelText("I confirm this image description")).not.toBeChecked();
});
test("failed analysis allows manual description without reuploading", async () => {
  jest.mocked(suggestImageDescription).mockResolvedValue({ id: "image-1", error: "Write your own to continue." });
  render(<ChallengeForm templates={[]} />);
  upload();
  await screen.findByText("Write your own to continue.");
  fireEvent.change(screen.getByLabelText("Image description"), { target: { value: "A square." } });
  fireEvent.change(screen.getByLabelText("Your caption"), { target: { value: "My joke." } });
  fireEvent.click(screen.getByLabelText("I confirm this image description"));
  expect(screen.getByRole("button", { name: "Create draft" })).toBeEnabled();
  expect(uploadChallengeImage).toHaveBeenCalledTimes(1);
});
test("an upload response cannot overwrite a newly selected template", async () => {
  let resolve!: (result: { id: string; description: string }) => void;
  jest.mocked(suggestImageDescription).mockReturnValue(new Promise(r => { resolve = r; }));
  render(<ChallengeForm templates={[{ id: "template-1", description: "Template description", image_url: "https://example.com/a.gif", created_at: "2026-01-01" }]} />);
  upload();
  await waitFor(() => expect(suggestImageDescription).toHaveBeenCalled());
  fireEvent.change(screen.getByLabelText("Image source"), { target: { value: "template" } });
  fireEvent.change(screen.getByLabelText(/Gallery template/), { target: { value: "template-1" } });
  await act(async () => resolve({ id: "image-1", description: "Old image description" }));
  expect(screen.getByLabelText("Image description")).toHaveValue("Template description");
  expect(screen.getByLabelText("I confirm this image description")).not.toBeChecked();
});

test("an interrupted request can retry the selected image without reopening the file picker", async () => {
  jest.mocked(suggestImageDescription).mockRejectedValueOnce(new Error("Connection lost"));
  render(<ChallengeForm templates={[]} />);
  upload();
  fireEvent.click(await screen.findByRole("button", { name: "Retry this image" }));
  await waitFor(() => expect(screen.getByLabelText("Image description")).toHaveValue("A yellow square."));
  expect(uploadChallengeImage).toHaveBeenCalledTimes(2);
});

test("image understanding is collapsed with a clear review status while joke context stays visible", async () => {
  render(<ChallengeForm templates={[]} />);
  upload();
  await waitFor(() => expect(screen.getByLabelText("Image description")).toHaveValue("A yellow square."));
  const review = screen.getByText("Review image understanding").closest("details")!;
  expect(review).not.toHaveAttribute("open");
  expect(screen.getByText("Confirmation needed")).toBeVisible();
  expect(screen.getByLabelText("Add context for the joke (optional)")).toBeVisible();
  fireEvent.click(screen.getByText("Review image understanding"));
  fireEvent.click(screen.getByLabelText("I confirm this image description"));
  expect(screen.getByText("Confirmed")).toBeVisible();
  fireEvent.change(screen.getByLabelText("Image description"), { target: { value: "A changed scene." } });
  expect(screen.getByText("Confirmation needed")).toBeVisible();
});
