import { render, screen } from "@testing-library/react";
import ProfilePage from "./page";
import { requireUser } from "@/lib/auth";

jest.mock("@/lib/auth", () => ({ requireUser: jest.fn() }));
jest.mock("@/components/site-header", () => ({ __esModule: true, default: () => null }));
jest.mock("./profile-form", () => ({
  __esModule: true,
  default: ({ profile, previousPhotos }: {
    profile: { favorite_joke: string | null }; previousPhotos: unknown[];
  }) => <div data-testid="editor">{profile.favorite_joke} / {previousPhotos.length} photos</div>,
}));
const auth = jest.mocked(requireUser);
const read = jest.fn();
const history = jest.fn();
const selectProfile = jest.fn(() => ({ eq: () => ({ maybeSingle: read }) }));
const selectPhotos = jest.fn(() => ({ eq: () => ({ order: () => ({ limit: history }) }) }));
const from = jest.fn();
const sign = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  from.mockImplementation((table: string) => {
    if (table === "profiles") return { select: selectProfile };
    if (table === "profile_photos") return { select: selectPhotos };
    throw new Error("Unexpected legacy table");
  });
  read.mockResolvedValue({ data: {
    id: "owner", first_name: "Ada", last_name: "Lovelace",
    member_profiles: { current_avatar_path: "owner/current.gif", favorite_joke: "New table joke" },
  }, error: null });
  history.mockResolvedValue({ data: [
    { avatar_path: "owner/old.gif", created_at: "2026-10-01" },
  ], error: null });
  sign.mockImplementation(async (paths: string[]) => ({
    data: paths.map(path => ({ path, signedUrl: "https://example.com/" + path, error: null })),
    error: null,
  }));
  auth.mockResolvedValue({ user: { id: "owner", email: "owner@example.com" },
    supabase: { from, storage: { from: () => ({ createSignedUrls: sign }) } },
  } as unknown as Awaited<ReturnType<typeof requireUser>>);
});
it("combines private identity with current presentation and the owned photo collection", async () => {
  render(await ProfilePage({}));
  expect(screen.getByTestId("editor")).toHaveTextContent("New table joke / 1 photos");
  expect(selectProfile).toHaveBeenCalledWith("id, first_name, last_name, member_profiles(current_avatar_path, favorite_joke)");
  expect(from).toHaveBeenCalledWith("profile_photos");
  expect(sign).toHaveBeenCalledWith(["owner/current.gif", "owner/old.gif"], 3600);
});
it("fails visibly if the signup trigger did not create the presentation row", async () => {
  read.mockResolvedValue({ data: { id: "owner", first_name: null, last_name: null, member_profiles: null }, error: null });
  render(await ProfilePage({}));
  expect(screen.getByRole("alert")).toHaveTextContent("couldn’t be loaded");
  expect(screen.queryByTestId("editor")).not.toBeInTheDocument();
});
it("retains the editor when the optional photo collection fails to load", async () => {
  history.mockResolvedValue({ data: null, error: { message: "Failed" } });
  render(await ProfilePage({}));
  expect(screen.getByTestId("editor")).toHaveTextContent("New table joke / 0 photos");
});
