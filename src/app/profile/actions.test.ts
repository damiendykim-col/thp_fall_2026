/** @jest-environment node */
import { saveProfile } from "./actions";
import { requireUser } from "@/lib/auth";

jest.mock("@/lib/auth", () => ({ requireUser: jest.fn() }));
jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }));
const requireAuth = jest.mocked(requireUser);
const read = jest.fn();
const update = jest.fn();
const eq = jest.fn();
const upload = jest.fn();
const remove = jest.fn();
const insert = jest.fn();
const from = jest.fn();
const historyRead = jest.fn();
const historyEq = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  read.mockResolvedValue({ data: { avatar_path: null }, error: null });
  eq.mockReturnValue({ select: () => ({ single: async () => ({ data: { id: "owner" }, error: null }) }) });
  update.mockReturnValue({ eq });
  insert.mockResolvedValue({ error: null });
  historyRead.mockResolvedValue({ data: { avatar_path: "owner/old.png" }, error: null });
  historyEq.mockReturnValue({ eq: historyEq, maybeSingle: historyRead });
  from.mockImplementation((table: string) => {
    if (table === "profiles") return { select: () => ({ eq: () => ({ single: read }) }), update };
    if (table === "profile_avatar_history") return { insert, select: () => ({ eq: historyEq }) };
    return null;
  });
  upload.mockResolvedValue({ error: null });
  remove.mockResolvedValue({ error: null });
  requireAuth.mockResolvedValue({
    user: { id: "owner" }, supabase: { from, storage: { from: () => ({ upload, remove }) } },
  } as unknown as Awaited<ReturnType<typeof requireUser>>);
});
function form() {
  const data = new FormData();
  data.set("first_name", " Ada ");
  data.set("last_name", " Lovelace ");
  return data;
}
it("requires authentication even for a directly invoked action", async () => {
  requireAuth.mockRejectedValue(new Error("redirect:/login"));
  await expect(saveProfile({}, form())).rejects.toThrow("redirect:/login");
  expect(update).not.toHaveBeenCalled();
});
it("never uses a submitted user ID to choose the profile", async () => {
  const data = form(); data.set("id", "someone-else");
  await expect(saveProfile({}, data)).resolves.toEqual({ success: true });
  expect(eq).toHaveBeenCalledWith("id", "owner");
  expect(update).toHaveBeenCalledWith({ first_name: "Ada", last_name: "Lovelace", favorite_joke: null });
});
it("rejects blank names before writing", async () => {
  const data = form(); data.set("last_name", " ");
  expect(await saveProfile({}, data)).toHaveProperty("error");
  expect(update).not.toHaveBeenCalled();
});
it.each([
  new File(["<svg />"], "photo.svg", { type: "image/svg+xml" }),
  new File([new Uint8Array(2 * 1024 * 1024 + 1)], "large.png", { type: "image/png" }),
])("rejects unsupported or oversized photos", async (file) => {
  const data = form(); data.set("photo", file);
  expect(await saveProfile({}, data)).toHaveProperty("error");
  expect(upload).not.toHaveBeenCalled();
});
it("uploads to the owner's folder and records the old photo as history", async () => {
  read.mockResolvedValue({ data: { avatar_path: "owner/old.png" }, error: null });
  const data = form(); data.set("photo", new File(["test"], "photo.png", { type: "image/png" }));
  expect(await saveProfile({}, data)).toEqual({ success: true });
  expect(upload.mock.calls[0][0]).toMatch(/^owner\/.*\.png$/);
  expect(insert).toHaveBeenCalledWith({ profile_id: "owner", avatar_path: "owner/old.png" });
  expect(remove).not.toHaveBeenCalledWith(["owner/old.png"]);
});
it("cleans up a new photo if the profile update fails", async () => {
  eq.mockReturnValue({ select: () => ({ single: async () => ({ data: null, error: new Error("failed") }) }) });
  const data = form(); data.set("photo", new File(["test"], "photo.png", { type: "image/png" }));
  expect(await saveProfile({}, data)).toHaveProperty("error");
  expect(remove).toHaveBeenCalledWith([upload.mock.calls[0][0]]);
});

it("preserves GIF uploads with the correct extension and content type", async () => {
  const data = form();
  const gif = new File(["GIF89a"], "avatar.gif", { type: "image/gif" });
  data.set("photo", gif);
  expect(await saveProfile({}, data)).toEqual({ success: true });
  expect(upload).toHaveBeenCalledWith(expect.stringMatching(/^owner\/.*\.gif$/), expect.any(File), { contentType: "image/gif", upsert: false });
});

it("saves favorite_joke when provided", async () => {
  const data = form();
  data.set("favorite_joke", "  A SQL query walks into a bar...  ");
  expect(await saveProfile({}, data)).toEqual({ success: true });
  expect(update).toHaveBeenCalledWith({
    first_name: "Ada",
    last_name: "Lovelace",
    favorite_joke: "A SQL query walks into a bar...",
  });
});

it("rejects non-text favorite_joke values", async () => {
  const data = form();
  data.set("favorite_joke", new File(["haha"], "joke.txt", { type: "text/plain" }));
  expect(await saveProfile({}, data)).toHaveProperty("error");
  expect(update).not.toHaveBeenCalled();
});

it("restores an owned history photo without re-uploading or deleting files", async () => {
  read.mockResolvedValue({ data: { avatar_path: "owner/current.png" }, error: null });
  insert.mockResolvedValue({ error: { code: "23505" } });
  const data = form(); data.set("previous_avatar", "owner/old.png");
  expect(await saveProfile({}, data)).toEqual({ success: true });
  expect(historyEq).toHaveBeenCalledWith("profile_id", "owner");
  expect(historyEq).toHaveBeenCalledWith("avatar_path", "owner/old.png");
  expect(update).toHaveBeenCalledWith(expect.objectContaining({ avatar_path: "owner/old.png" }));
  expect(upload).not.toHaveBeenCalled(); expect(remove).not.toHaveBeenCalled();
});
it.each(["other/private.png", "owner/not-in-history.png"])("rejects an unauthorized selection %s", async path => {
  historyRead.mockResolvedValue({ data: null, error: null });
  const data = form(); data.set("previous_avatar", path);
  expect(await saveProfile({}, data)).toHaveProperty("error");
  expect(update).not.toHaveBeenCalled(); expect(upload).not.toHaveBeenCalled();
});
it("does not change the current photo if history cannot be retained", async () => {
  read.mockResolvedValue({ data: { avatar_path: "owner/current.png" }, error: null });
  insert.mockResolvedValue({ error: { code: "42501" } });
  const data = form(); data.set("previous_avatar", "owner/old.png");
  expect(await saveProfile({}, data)).toHaveProperty("error");
  expect(update).not.toHaveBeenCalled(); expect(remove).not.toHaveBeenCalled();
});
it("rejects conflicting upload and history selections", async () => {
  const data = form(); data.set("previous_avatar", "owner/old.png");
  data.set("photo", new File(["GIF"], "photo.gif", { type: "image/gif" }));
  expect(await saveProfile({}, data)).toHaveProperty("error");
  expect(update).not.toHaveBeenCalled();
});
