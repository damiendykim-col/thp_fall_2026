/** @jest-environment node */
import { measureOperation } from "./performance";

const originalFlag = process.env.PERF_LOGGING;
afterEach(() => {
  if (originalFlag === undefined) delete process.env.PERF_LOGGING;
  else process.env.PERF_LOGGING = originalFlag;
  jest.restoreAllMocks();
});

it("is silent when disabled and preserves the operation result", async () => {
  delete process.env.PERF_LOGGING;
  const log = jest.spyOn(console, "info").mockImplementation(() => {});
  const result = { data: "private result" };
  expect(await measureOperation("profile.read", async () => result)).toBe(result);
  expect(log).not.toHaveBeenCalled();
});

it("logs only a fixed operation label and elapsed time, including for returned API errors", async () => {
  process.env.PERF_LOGGING = "true";
  const log = jest.spyOn(console, "info").mockImplementation(() => {});
  jest.spyOn(performance, "now").mockReturnValueOnce(10).mockReturnValueOnce(22.5);
  const result = { error: { message: "private object path" } };
  expect(await measureOperation("members.avatar", async () => result)).toBe(result);
  expect(log).toHaveBeenCalledTimes(1);
  expect(JSON.parse(log.mock.calls[0][0])).toEqual({
    event: "app-performance", operation: "members.avatar", durationMs: 12.5,
  });
});

it("preserves exceptions while recording the elapsed operation", async () => {
  process.env.PERF_LOGGING = "true";
  const log = jest.spyOn(console, "info").mockImplementation(() => {});
  const error = new Error("private detail");
  await expect(measureOperation("page.auth", async () => { throw error; })).rejects.toBe(error);
  expect(log).toHaveBeenCalledTimes(1);
  expect(log.mock.calls[0][0]).not.toContain("private detail");
});
