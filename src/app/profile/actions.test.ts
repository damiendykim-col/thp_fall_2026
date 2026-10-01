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
const from = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  read.mockResolvedValue({ data: { avatar_path: null }, error: null });
  eq.mockReturnValue({ select: () => ({ single: async () => ({ data: { id: "owner" }, error: null }) }) });
  update.mockReturnValue({ eq });
  from.mockReturnValue({ select: () => ({ eq: () => ({ single: read }) }), update });
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
  expect(update).toHaveBeenCalledWith({ first_name: "Ada", last_name: "Lovelace" });
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
it("uploads to the owner's folder and deletes the old photo after saving", async () => {
  read.mockResolvedValue({ data: { avatar_path: "owner/old.png" }, error: null });
  const data = form(); data.set("photo", new File(["test"], "photo.png", { type: "image/png" }));
  expect(await saveProfile({}, data)).toEqual({ success: true });
  expect(upload.mock.calls[0][0]).toMatch(/^owner\/.*\.png$/);
  expect(remove).toHaveBeenCalledWith(["owner/old.png"]);
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
