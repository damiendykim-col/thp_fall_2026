/** @jest-environment node */
jest.mock("@/lib/test-auth-config", () => ({ isTestAuthEnabled: jest.fn() }));
jest.mock("@/lib/auth", () => ({ requireUser: jest.fn() }));
jest.mock("../../../../scripts/experiments/gif.mjs", () => ({ prepareGif: jest.fn() }));
import { inspectGif } from "./actions";
import { isTestAuthEnabled } from "@/lib/test-auth-config";
import { requireUser } from "@/lib/auth";
import { prepareGif } from "../../../../scripts/experiments/gif.mjs";
beforeEach(() => jest.clearAllMocks());
test("the action cannot process GIFs when the isolated local gate is disabled", async () => {
  jest.mocked(isTestAuthEnabled).mockReturnValue(false);
  expect(await inspectGif(new FormData())).toEqual({ error: "This experiment is available only in local development." });
  expect(requireUser).not.toHaveBeenCalled(); expect(prepareGif).not.toHaveBeenCalled();
});
test("oversized GIFs are rejected without decoding", async () => {
  jest.mocked(isTestAuthEnabled).mockReturnValue(true);
  const form = new FormData(); form.set("image", new File([new Uint8Array(3*1024*1024+1)], "large.gif"));
  expect((await inspectGif(form)).error).toBe("Choose a GIF up to 3 MB.");
  expect(requireUser).toHaveBeenCalled(); expect(prepareGif).not.toHaveBeenCalled();
});
