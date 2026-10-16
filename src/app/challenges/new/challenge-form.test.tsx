import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import ChallengeForm from "./challenge-form";
import { uploadChallengeImage, suggestImageDescription, restoreChallengeImage } from "../image-actions";

jest.mock("next/navigation", () => ({ useRouter: () => ({ push: jest.fn() }) }));
jest.mock("../actions", () => ({ createChallenge: jest.fn(), updateChallenge: jest.fn() }));
jest.mock("../image-actions", () => ({ uploadChallengeImage: jest.fn(), suggestImageDescription: jest.fn(), restoreChallengeImage: jest.fn() }));
beforeEach(() => {
  jest.clearAllMocks();
  sessionStorage.clear();
  jest.mocked(restoreChallengeImage).mockResolvedValue({ url: "https://example.com/restored.jpg" });
  jest.mocked(uploadChallengeImage).mockResolvedValue({ id: "image-1" });
  jest.mocked(suggestImageDescription).mockResolvedValue({ id: "image-1", description: "A yellow square." });
  URL.createObjectURL = jest.fn(() => "blob:preview");
  URL.revokeObjectURL = jest.fn();
});
function upload() {
  fireEvent.change(screen.getByLabelText(/Challenge image/), { target: { files: [new File(["image"], "test.png", { type: "image/png" })] } });
}
test("a suggestion needs explicit confirmation, and editing invalidates confirmation", async () => {
  render(<ChallengeForm userId="user-1" templates={[]} />);
  upload();
  await waitFor(() => expect(screen.getByLabelText("Image description")).toHaveValue("A yellow square."));
  fireEvent.change(screen.getByLabelText("Your caption"), { target: { value: "My joke." } });
  expect(screen.getByRole("button", { name: "Create draft", hidden: true })).toBeDisabled();
  fireEvent.click(screen.getByLabelText("I confirm this image description"));
  expect(screen.getByRole("button", { name: "Create draft", hidden: true })).toBeEnabled();
  fireEvent.change(screen.getByLabelText("Image description"), { target: { value: "A yellow rectangle." } });
  expect(screen.getByLabelText("I confirm this image description")).not.toBeChecked();
});
test("failed analysis allows manual description without reuploading", async () => {
  jest.mocked(suggestImageDescription).mockResolvedValue({ id: "image-1", error: "Write your own to continue." });
  render(<ChallengeForm userId="user-1" templates={[]} />);
  upload();
  await screen.findByText("Write your own to continue.");
  fireEvent.change(screen.getByLabelText("Image description"), { target: { value: "A square." } });
  fireEvent.change(screen.getByLabelText("Your caption"), { target: { value: "My joke." } });
  fireEvent.click(screen.getByLabelText("I confirm this image description"));
  expect(screen.getByRole("button", { name: "Create draft", hidden: true })).toBeEnabled();
  expect(uploadChallengeImage).toHaveBeenCalledTimes(1);
});
test("an upload response cannot overwrite a newly selected template", async () => {
  let resolve!: (result: { id: string; description: string }) => void;
  jest.mocked(suggestImageDescription).mockReturnValue(new Promise(r => { resolve = r; }));
  render(<ChallengeForm userId="user-1" templates={[{ id: "template-1", description: "Template description", image_url: "https://example.com/a.gif", created_at: "2026-01-01" }]} />);
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
  render(<ChallengeForm userId="user-1" templates={[]} />);
  upload();
  fireEvent.click(await screen.findByRole("button", { name: "Retry description" }));
  await waitFor(() => expect(screen.getByLabelText("Image description")).toHaveValue("A yellow square."));
  expect(uploadChallengeImage).toHaveBeenCalledTimes(1);
});

test("image understanding opens automatically when confirmation is needed", async () => {
  render(<ChallengeForm userId="user-1" templates={[]} />);
  upload();
  await waitFor(() => expect(screen.getByLabelText("Image description")).toHaveValue("A yellow square."));
  const review = screen.getByText("Review image understanding").closest("details")!;
  expect(review).toHaveAttribute("open");
  expect(screen.getByText("Confirmation needed")).toBeVisible();
  expect(screen.getByLabelText("Add context for the joke (optional)")).not.toBeVisible();
  fireEvent.click(screen.getByLabelText("I confirm this image description"));
  expect(screen.getByText("Confirmed")).toBeVisible();
  fireEvent.change(screen.getByLabelText("Image description"), { target: { value: "A changed scene." } });
  expect(screen.getByText("Confirmation needed")).toBeVisible();
});

test("an unfinished description keeps manual review disabled and can be retried without reupload", async () => {
  jest.mocked(suggestImageDescription).mockResolvedValueOnce({ error: "Still running." });
  render(<ChallengeForm userId="user-1" templates={[]} />);
  upload();
  await screen.findByText("Still running.");
  expect(screen.getByLabelText("Image description")).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "Retry description" }));
  await waitFor(() => expect(screen.getByLabelText("Image description")).toHaveValue("A yellow square."));
  expect(uploadChallengeImage).toHaveBeenCalledTimes(1);
});

test("unfinished text survives navigation only for the same account and can be discarded", () => {
  const first = render(<ChallengeForm userId="user-1" templates={[]} />);
  fireEvent.change(screen.getByLabelText("Your caption"), { target: { value: "Keep my joke" } });
  fireEvent.change(screen.getByLabelText("Add context for the joke (optional)"), { target: { value: "Finals week" } });
  first.unmount();
  const other = render(<ChallengeForm userId="user-2" templates={[]} />);
  expect(screen.getByLabelText("Your caption")).toHaveValue("");
  other.unmount();
  const restored = render(<ChallengeForm userId="user-1" templates={[]} />);
  expect(screen.getByLabelText("Your caption")).toHaveValue("Keep my joke");
  expect(screen.getByLabelText("Add context for the joke (optional)")).toHaveValue("Finals week");
  fireEvent.click(screen.getByRole("button", { name: "Discard unfinished challenge" }));
  restored.unmount();
  render(<ChallengeForm userId="user-1" templates={[]} />);
  expect(screen.getByLabelText("Your caption")).toHaveValue("");
});

test.each(["running", "interrupted", "failed"])("GIF frames remain saved when description is %s", async (outcome) => {
  jest.mocked(uploadChallengeImage).mockResolvedValueOnce({ storyboard: {
    durationMs: 100, selected: [0], frames: [{ index: 0, startMs: 0, durationMs: 100, src: "data:image/jpeg;base64,AA==" }],
  } });
  if (outcome === "interrupted") jest.mocked(suggestImageDescription).mockRejectedValueOnce(new Error("offline"));
  else jest.mocked(suggestImageDescription).mockResolvedValueOnce(outcome === "running" ? { error: "Still running." } : { id: "image-1", error: "Write your own to continue." });
  render(<ChallengeForm userId="user-1" templates={[]} />);
  upload();
  fireEvent.click(await screen.findByRole("button", { name: "Use these frames" }));
  await screen.findByRole("button", { name: "Frames confirmed" });
  if (outcome === "failed") {
    expect(screen.getByLabelText("Image description")).toBeEnabled();
    expect(document.querySelector('input[name="manual"]')).toHaveValue("true");
  } else {
    expect(screen.getByLabelText("Image description")).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Retry description" }));
    await waitFor(() => expect(screen.getByLabelText("Image description")).toHaveValue("A yellow square."));
  }
  expect(uploadChallengeImage).toHaveBeenCalledTimes(2);
});

test("saved upload and edited review restore without persisting bytes or URLs", async () => {
  const first = render(<ChallengeForm userId="user-1" templates={[]} />);
  upload();
  await waitFor(() => expect(screen.getByLabelText("Image description")).toHaveValue("A yellow square."));
  fireEvent.change(screen.getByLabelText("Image description"), { target: { value: "My edited scene." } });
  fireEvent.click(screen.getByLabelText("I confirm this image description"));
  fireEvent.change(screen.getByLabelText("Your caption"), { target: { value: "My joke" } });
  const stored = sessionStorage.getItem("meme-club:challenge-draft:user-1")!;
  expect(stored).not.toContain("blob:");
  expect(stored).not.toContain("data:");
  first.unmount();
  render(<ChallengeForm userId="user-1" templates={[]} />);
  await waitFor(() => expect(screen.getByRole("button", { name: "Create draft", hidden: true })).toBeEnabled());
  expect(restoreChallengeImage).toHaveBeenCalledWith("image-1");
  expect(screen.getByLabelText("Image description")).toHaveValue("My edited scene.");
  expect(screen.getByLabelText("I confirm this image description")).toBeChecked();
  expect(uploadChallengeImage).toHaveBeenCalledTimes(1);
  expect(suggestImageDescription).toHaveBeenCalledTimes(1);
});

test("unconfirmed local GIF requires reselection but preserves the joke", async () => {
  jest.mocked(uploadChallengeImage).mockResolvedValueOnce({ storyboard: {
    durationMs: 100, selected: [0], frames: [{ index: 0, startMs: 0, durationMs: 100, src: "data:image/jpeg;base64,AA==" }],
  } });
  const first = render(<ChallengeForm userId="user-1" templates={[]} />);
  upload();
  await screen.findByRole("button", { name: "Use these frames" });
  fireEvent.change(screen.getByLabelText("Your caption"), { target: { value: "Keep me" } });
  first.unmount();
  render(<ChallengeForm userId="user-1" templates={[]} />);
  expect(screen.getByText(/Choose your local file again/)).toBeVisible();
  expect(screen.getByLabelText("Your caption")).toHaveValue("Keep me");
  expect(screen.getByRole("button", { name: "Create draft", hidden: true })).toBeDisabled();
  expect(restoreChallengeImage).not.toHaveBeenCalled();
});

test("template review survives reload, and a missing template keeps text but requires a new choice", () => {
  const templates = [{ id: "t1", description: "A template", image_url: "https://example.com/a.jpg", created_at: "2026-01-01" }];
  const first = render(<ChallengeForm userId="user-1" templates={templates} />);
  fireEvent.change(screen.getByLabelText("Image source"), { target: { value: "template" } });
  fireEvent.change(screen.getByLabelText("Gallery template"), { target: { value: "t1" } });
  fireEvent.change(screen.getByLabelText("Your caption"), { target: { value: "My joke" } });
  fireEvent.click(screen.getByLabelText("I confirm this image description"));
  first.unmount();
  const second = render(<ChallengeForm userId="user-1" templates={templates} />);
  expect(screen.getByRole("button", { name: "Create draft", hidden: true })).toBeEnabled();
  expect(screen.getByLabelText("Gallery template")).toHaveValue("t1");
  second.unmount();
  render(<ChallengeForm userId="user-1" templates={[]} />);
  expect(screen.getByLabelText("Your caption")).toHaveValue("My joke");
  expect(screen.getByRole("button", { name: "Create draft", hidden: true })).toBeDisabled();
});

test("a late restore response cannot overwrite a replacement image choice", async () => {
  const { writeChallengeDraft } = await import("@/lib/challenge-draft");
  writeChallengeDraft("user-1", {
    source: "upload", template: "", imageId: "image-1", submission: "attempt-1",
    description: "Old scene", suggestion: "", context: "", caption: "My joke",
    manual: true, confirmed: true, needsFile: false, imageReady: true,
  });
  let resolve!: (value: { url: string }) => void;
  jest.mocked(restoreChallengeImage).mockReturnValue(new Promise(r => { resolve = r; }));
  render(<ChallengeForm userId="user-1" templates={[]} />);
  fireEvent.change(screen.getByLabelText("Image source"), { target: { value: "template" } });
  await act(async () => resolve({ url: "https://example.com/old.jpg" }));
  expect(screen.queryByRole("img", { name: "Selected challenge image" })).toBeNull();
  expect(screen.getByRole("button", { name: "Create draft", hidden: true })).toBeDisabled();
});


test("edit recovery is separate from new creation and cannot replay across revisions", () => {
  const templates = [{ id: "t1", description: "A scene", image_url: "https://example.com/a.jpg", created_at: "2026-01-01" }];
  const initial = { source: "template", template: "t1", imageId: "", submission: "", description: "A scene", suggestion: "", context: "Monday", caption: "Saved joke", manual: false, confirmed: true, needsFile: false, imageReady: false };
  const first = render(<ChallengeForm userId="user-1" templates={templates} />);
  fireEvent.change(screen.getByLabelText("Your caption"), { target: { value: "Separate new challenge" } });
  first.unmount();
  const edit = render(<ChallengeForm userId="user-1" templates={templates} editing={{ id: "c1", revision: 0, initial }} />);
  expect(screen.getByLabelText("Your caption")).toHaveValue("Saved joke");
  fireEvent.change(screen.getByLabelText("Your caption"), { target: { value: "Unfinished edit" } });
  edit.unmount();
  const newer = render(<ChallengeForm userId="user-1" templates={templates} editing={{ id: "c1", revision: 1, initial: { ...initial, caption: "New server version" } }} />);
  expect(screen.getByLabelText("Your caption")).toHaveValue("New server version");
  fireEvent.click(screen.getByRole("button", { name: "Discard edits" }));
  expect(sessionStorage.getItem("meme-club:challenge-draft:user-1:edit:c1:1")).toBeNull();
  newer.unmount();
  render(<ChallengeForm userId="user-1" templates={templates} />);
  expect(screen.getByLabelText("Your caption")).toHaveValue("Separate new challenge");
});

test("creation starts with image review, preserves a caption across stages, and invalidates a changed scene", async () => {
  render(<ChallengeForm userId="user-1" templates={[]} />);
  expect(screen.getByRole("button", { name: "Continue to caption" })).toBeDisabled();
  expect(screen.getByLabelText("Your caption")).not.toBeVisible();
  upload();
  await waitFor(() => expect(screen.getByLabelText("Image description")).toHaveValue("A yellow square."));
  fireEvent.click(screen.getByLabelText("I confirm this image description"));
  fireEvent.click(screen.getByRole("button", { name: "Continue to caption" }));
  expect(screen.getByLabelText("Your caption")).toBeVisible();
  fireEvent.change(screen.getByLabelText("Your caption"), { target: { value: "A square deal" } });
  fireEvent.click(screen.getByRole("button", { name: "Back to image" }));
  fireEvent.change(screen.getByLabelText("Image description"), { target: { value: "A different scene" } });
  expect(screen.getByRole("button", { name: "Continue to caption" })).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "2. Your caption" }));
  expect(screen.getByLabelText("Your caption")).toHaveValue("A square deal");
  expect(screen.getByRole("button", { name: "Create draft", hidden: true })).toBeDisabled();
});
