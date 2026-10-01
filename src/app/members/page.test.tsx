import { render, screen } from "@testing-library/react";
import MembersPage from "./page";
import { requireCompleteProfile } from "@/lib/auth";

jest.mock("@/lib/auth", () => ({ requireCompleteProfile: jest.fn() }));
jest.mock("@/components/site-header", () => ({ __esModule: true, default: () => null }));

const auth = jest.mocked(requireCompleteProfile);
const sign = jest.fn();
const rpc = jest.fn();
beforeEach(() => {
  jest.clearAllMocks();
  auth.mockResolvedValue({ supabase: { rpc, storage: { from: () => ({ createSignedUrl: sign }) } } } as unknown as Awaited<ReturnType<typeof requireCompleteProfile>>);
});
it("renders signed photos for multiple members without personal details", async () => {
  rpc.mockResolvedValue({ data: [
    { id: "one", avatar_path: "one/current.gif", favorite_joke: "First joke", email: "private@example.com", first_name: "Private name" },
    { id: "two", avatar_path: "two/current.png", favorite_joke: "Second joke" },
  ], error: null });
  sign.mockImplementation(async (path: string) => ({ data: { signedUrl: `https://example.com/${path}` }, error: null }));
  render(await MembersPage());
  expect(screen.getAllByRole("img")).toHaveLength(2);
  expect(sign).toHaveBeenCalledWith("two/current.png", 3600);
  expect(screen.getByText("Second joke")).toBeInTheDocument();
  expect(screen.queryByText("Private name")).not.toBeInTheDocument();
  expect(screen.queryByText("private@example.com")).not.toBeInTheDocument();
});
it("distinguishes a signing failure from a member with no photo", async () => {
  rpc.mockResolvedValue({ data: [
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
