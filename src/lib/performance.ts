// Fixed labels keep emails, tokens, object paths, and query values out of logs.
type Operation =
  | "proxy.auth" | "page.auth" | "header.auth" | "login.auth"
  | "profile.completion" | "profile.read" | "profile.history"
  | "profile.avatar" | "profile.history-avatar"
  | "members.list" | "members.avatar" | "images.list";

export async function measureOperation<T>(name: Operation, operation: () => PromiseLike<T>): Promise<T> {
  if (process.env.PERF_LOGGING !== "true") return await operation();
  const start = performance.now();
  try {
    return await operation();
  } finally {
    console.info(JSON.stringify({
      event: "app-performance",
      operation: name,
      durationMs: Math.round((performance.now() - start) * 10) / 10,
    }));
  }
}
