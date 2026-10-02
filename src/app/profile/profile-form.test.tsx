import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import ProfileForm from "./profile-form";
import { saveProfile } from "./actions";
import { DRAFT_PREFIX, clearProfileDrafts } from "@/lib/profile-draft";
jest.mock("./actions", () => ({ saveProfile: jest.fn() }));
const profile = { id: "owner", first_name: "Ada", last_name: "Lovelace", favorite_joke: "Joke", avatar_path: "owner/current.gif" };
const photos = [{ avatarPath: "owner/old.gif", url: "https://example.com/old.gif", createdAt: "2026-10-01" }];
function form() { return <ProfileForm profile={profile} avatarUrl="https://example.com/current.gif" previousPhotos={photos} />; }
beforeEach(() => { sessionStorage.clear(); jest.clearAllMocks(); });
it("previews, highlights and restores a previous-photo draft, then cancels only the photo", () => {
  const first = render(form());
  fireEvent.change(screen.getByLabelText("Favorite joke"), { target: { value: "New joke" } });
  fireEvent.click(screen.getByRole("button", { name: /Change photo/ }));
  fireEvent.click(screen.getByRole("button", { name: "Use previous photo 1" }));
  expect(screen.getByAltText("Your profile photo preview")).toHaveAttribute("src", photos[0].url);
  expect(screen.getByRole("button", { name: "Use previous photo 1" })).toHaveAttribute("aria-pressed", "true");
  expect(screen.getByRole("button", { name: "Save profile" })).toHaveClass("save-changed");
  expect(saveProfile).not.toHaveBeenCalled();
  expect(sessionStorage.getItem(DRAFT_PREFIX + "owner")).not.toContain("https:");
  first.unmount(); render(form());
  expect(screen.getByText(/Unsaved changes restored/)).toBeInTheDocument();
  expect(screen.getByAltText("Your profile photo preview")).toHaveAttribute("src", photos[0].url);
  fireEvent.click(screen.getByRole("button", { name: "Cancel photo change" }));
  expect(screen.getByAltText("Your profile photo preview")).toHaveAttribute("src", "https://example.com/current.gif");
  expect(screen.getByLabelText("Favorite joke")).toHaveValue("New joke");
  fireEvent.click(screen.getByRole("button", { name: "Discard changes" }));
  expect(screen.getByLabelText("Favorite joke")).toHaveValue("Joke");
  expect(sessionStorage.getItem(DRAFT_PREFIX + "owner")).toBeNull();
});
it("ignores another account's draft and clears drafts on sign-out", () => {
  sessionStorage.setItem(DRAFT_PREFIX + "other", JSON.stringify({ first: "Other", last: "User", joke: "Private", previous: "", needsFile: false }));
  render(form()); expect(screen.getByLabelText("First name")).toHaveValue("Ada");
  clearProfileDrafts(); expect(sessionStorage.length).toBe(0);
});
it("restores text but asks for a local file again", () => {
  sessionStorage.setItem(DRAFT_PREFIX + "owner", JSON.stringify({ first: "Draft", last: "Name", joke: "", previous: "", needsFile: true }));
  render(form());
  expect(screen.getByLabelText("First name")).toHaveValue("Draft");
  expect(screen.getByText(/Please select your local photo again/)).toBeInTheDocument();
});
it("saves the selection and clears the draft only on success", async () => {
  jest.mocked(saveProfile).mockResolvedValue({ success: true });
  render(form());
  fireEvent.click(screen.getByRole("button", { name: /Change photo/ }));
  fireEvent.click(screen.getByRole("button", { name: "Use previous photo 1" }));
  fireEvent.click(screen.getByRole("button", { name: "Save profile" }));
  await waitFor(() => expect(saveProfile).toHaveBeenCalled());
  expect(jest.mocked(saveProfile).mock.calls[0][1].get("previous_avatar")).toBe("owner/old.gif");
  await waitFor(() => expect(sessionStorage.getItem(DRAFT_PREFIX + "owner")).toBeNull());
});
it("retains the draft when saving fails", async () => {
  jest.mocked(saveProfile).mockResolvedValue({ error: "Could not save" });
  render(form()); fireEvent.change(screen.getByLabelText("Favorite joke"), { target: { value: "Pending" } });
  fireEvent.click(screen.getByRole("button", { name: "Save profile" }));
  await screen.findByText("Could not save");
  expect(sessionStorage.getItem(DRAFT_PREFIX + "owner")).toContain("Pending");
});
