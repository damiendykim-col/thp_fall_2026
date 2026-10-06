import { readFileSync } from "node:fs";
import path from "node:path";

export function localEnvironment() {
  let env: { url: string; anonKey: string; serviceKey: string };
  try {
    env = JSON.parse(readFileSync(path.resolve("e2e/.runtime/env.json"), "utf8"));
  } catch {
    throw new Error("Start isolated local Supabase first: npm run e2e:setup");
  }
  if (env.url !== "http://127.0.0.1:55421" || !env.anonKey || !env.serviceKey) {
    throw new Error("E2E requires local Supabase at 127.0.0.1:55421 and its local keys.");
  }
  return env;
}
