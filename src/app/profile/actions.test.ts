/** @jest-environment node */
import { saveProfile } from "./actions";
import { requireUser } from "@/lib/auth";
import { revalidatePath } from "next/cache";

jest.mock("@/lib/auth", () => ({ requireUser: jest.fn() }));
jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }));
const requireAuth = jest.mocked(requireUser);
const rpc = jest.fn();
const upload = jest.fn();
const remove = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  rpc.mockResolvedValue({ data: "owner", error: null });
  upload.mockResolvedValue({ error: null });
  remove.mockResolvedValue({ error: null });
  requireAuth.mockResolvedValue({
    user: { id: "owner" }, supabase: { rpc, storage: { from: () => ({ upload, remove }) } },
  } as unknown as Awaited<ReturnType<typeof requireUser>>);
});
function form() {
  const data = new FormData();
  data.set("first_name", " Ada ");
  data.set("last_name", " Lovelace ");
  return data;
}
function withPhoto() {
  const data = form();
  data.set("photo", new File(["GIF89a"], "avatar.gif", { type: "image/gif" }));
  return data;
}
it("requires authentication even for a directly invoked action", async () => {
  requireAuth.mockRejectedValue(new Error("redirect:/login"));
  await expect(saveProfile({}, form())).rejects.toThrow("redirect:/login");
  expect(rpc).not.toHaveBeenCalled();
});
it("saves atomically without forwarding a submitted user ID", async () => {
  const data = form(); data.set("id", "someone-else");
  data.set("favorite_joke", "  A SQL query walks into a bar...  ");
  await expect(saveProfile({}, data)).resolves.toEqual({ success: true });
  expect(rpc).toHaveBeenCalledTimes(1);
  expect(rpc).toHaveBeenCalledWith("save_my_profile", {
    p_first_name: "Ada", p_last_name: "Lovelace",
    p_favorite_joke: "A SQL query walks into a bar...",
    p_avatar_path: null, p_avatar_is_upload: false,
  });
  expect(revalidatePath).toHaveBeenCalledWith("/members");
  expect(revalidatePath).toHaveBeenCalledWith("/profile");
});
it("rejects blank names before writing", async () => {
  const data = form(); data.set("last_name", " ");
  expect(await saveProfile({}, data)).toHaveProperty("error");
  expect(rpc).not.toHaveBeenCalled();
});
it.each([
  new File(["<svg />"], "photo.svg", { type: "image/svg+xml" }),
  new File([new Uint8Array(2 * 1024 * 1024 + 1)], "large.png", { type: "image/png" }),
])("rejects unsupported or oversized photos", async (file) => {
  const data = form(); data.set("photo", file);
  expect(await saveProfile({}, data)).toHaveProperty("error");
  expect(upload).not.toHaveBeenCalled(); expect(rpc).not.toHaveBeenCalled();
});
it("uploads GIFs under a unique owner path before registering them in the transaction", async () => {
  expect(await saveProfile({}, withPhoto())).toEqual({ success: true });
  const path = upload.mock.calls[0][0];
  expect(path).toMatch(/^owner\/.*\.gif$/);
  expect(upload).toHaveBeenCalledWith(path, expect.any(File), { contentType: "image/gif", upsert: false });
  expect(rpc).toHaveBeenCalledWith("save_my_profile", expect.objectContaining({
    p_avatar_path: path, p_avatar_is_upload: true,
  }));
  expect(remove).not.toHaveBeenCalled();
});
it("does not save when upload fails", async () => {
  upload.mockResolvedValue({ error: { message: "Failed" } });
  expect(await saveProfile({}, withPhoto())).toHaveProperty("error");
  expect(rpc).not.toHaveBeenCalled();
});
it("removes only the new upload after a definite database rejection", async () => {
  rpc.mockResolvedValue({ data: null, error: { code: "42501" } });
  expect(await saveProfile({}, withPhoto())).toHaveProperty("error");
  expect(remove).toHaveBeenCalledWith([upload.mock.calls[0][0]]);
  expect(revalidatePath).not.toHaveBeenCalled();
});
it("keeps the uploaded photo when a lost response leaves commit status unknown", async () => {
  rpc.mockResolvedValue({ data: null, error: { code: "", message: "fetch failed" } });
  expect(await saveProfile({}, withPhoto())).toHaveProperty("error");
  expect(remove).not.toHaveBeenCalled();
});
it("does not report success for an unexpected RPC response", async () => {
  rpc.mockResolvedValue({ data: null, error: null });
  expect(await saveProfile({}, form())).toHaveProperty("error");
  expect(revalidatePath).not.toHaveBeenCalled();
});
it("clears an empty joke without changing the current photo", async () => {
  const data = form(); data.set("favorite_joke", " ");
  expect(await saveProfile({}, data)).toEqual({ success: true });
  expect(rpc).toHaveBeenCalledWith("save_my_profile", expect.objectContaining({
    p_favorite_joke: null, p_avatar_path: null, p_avatar_is_upload: false,
  }));
});
it("rejects non-text favorite_joke values", async () => {
  const data = form(); data.set("favorite_joke", new File(["haha"], "joke.txt"));
  expect(await saveProfile({}, data)).toHaveProperty("error");
  expect(rpc).not.toHaveBeenCalled();
});
it("restores a collection photo without uploading or deleting files", async () => {
  const data = form(); data.set("previous_avatar", "owner/old.png");
  expect(await saveProfile({}, data)).toEqual({ success: true });
  expect(rpc).toHaveBeenCalledWith("save_my_profile", expect.objectContaining({
    p_avatar_path: "owner/old.png", p_avatar_is_upload: false,
  }));
  expect(upload).not.toHaveBeenCalled(); expect(remove).not.toHaveBeenCalled();
});
it("rejects a path belonging to another user before calling the database", async () => {
  const data = form(); data.set("previous_avatar", "other/private.png");
  expect(await saveProfile({}, data)).toHaveProperty("error");
  expect(rpc).not.toHaveBeenCalled();
});
it("surfaces a database ownership rejection without claiming success", async () => {
  rpc.mockResolvedValue({ data: null, error: { code: "42501" } });
  const data = form(); data.set("previous_avatar", "owner/not-in-collection.png");
  expect(await saveProfile({}, data)).toHaveProperty("error");
  expect(revalidatePath).not.toHaveBeenCalled(); expect(remove).not.toHaveBeenCalled();
});
it("rejects conflicting upload and collection selections", async () => {
  const data = withPhoto(); data.set("previous_avatar", "owner/old.png");
  expect(await saveProfile({}, data)).toHaveProperty("error");
  expect(rpc).not.toHaveBeenCalled(); expect(upload).not.toHaveBeenCalled();
});
