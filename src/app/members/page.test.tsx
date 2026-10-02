import { render, screen } from "@testing-library/react";
import MembersPage from "./page";
import { requireCompleteProfile } from "@/lib/auth";

jest.mock("@/lib/auth", () => ({ requireCompleteProfile: jest.fn() }));
jest.mock("@/components/site-header", () => ({ __esModule: true, default: () => null }));

const auth = jest.mocked(requireCompleteProfile);
const sign = jest.fn();
const list = jest.fn();
const select = jest.fn(() => ({ eq: list }));
const from = jest.fn(() => ({ select }));
beforeEach(() => {
  jest.clearAllMocks();
  auth.mockResolvedValue({ supabase: { from, storage: { from: () => ({ createSignedUrls: sign }) } } } as unknown as Awaited<ReturnType<typeof requireCompleteProfile>>);
});
it("renders signed photos for multiple members without personal details", async () => {
  list.mockResolvedValue({ data: [
    { id: "one", avatar_path: "one/current.gif", favorite_joke: "First joke", email: "private@example.com", first_name: "Private name" },
    { id: "two", avatar_path: "two/current.png", favorite_joke: "Second joke" },
  ], error: null });
  sign.mockImplementation(async (paths: string[]) => ({ data: paths.slice().reverse().map(path => ({ path, signedUrl: `https://example.com/${path}`, error: null })), error: null }));
  render(await MembersPage());
  expect(screen.getAllByRole("img")).toHaveLength(2);
  expect(sign).toHaveBeenCalledTimes(1);
  expect(sign).toHaveBeenCalledWith(["one/current.gif", "two/current.png"], 3600);
  expect(screen.getAllByRole("img")[0]).toHaveAttribute("src", "https://example.com/one/current.gif");
  expect(screen.getByText("Second joke")).toBeInTheDocument();
  expect(screen.queryByText("Private name")).not.toBeInTheDocument();
  expect(screen.queryByText("private@example.com")).not.toBeInTheDocument();
});
it("distinguishes a signing failure from a member with no photo", async () => {
  list.mockResolvedValue({ data: [
    { id: "one", avatar_path: "one/current.gif", favorite_joke: "First joke" },
    { id: "two", avatar_path: null, favorite_joke: null },
  ], error: null });
  sign.mockResolvedValue({ data: null, error: { message: "Access denied" } });
  const log = jest.spyOn(console, "error").mockImplementation(() => {});
  try {
    render(await MembersPage());
    expect(screen.getByText("Photo unavailable")).toBeInTheDocument();
    expect(screen.getByText("No photo")).toBeInTheDocument();
    expect(log).toHaveBeenCalled();
  } finally { log.mockRestore(); }
});
