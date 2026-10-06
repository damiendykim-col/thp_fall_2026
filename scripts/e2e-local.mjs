import { execFileSync } from "node:child_process";
import { mkdirSync, copyFileSync, readdirSync, writeFileSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const root = resolve(import.meta.dirname, "..");
const workdir = resolve(root, "e2e/.runtime");
const cli = resolve(root, "node_modules/.bin/supabase");
const command = process.argv[2] ?? "start";
function run(args, capture = false) {
  return execFileSync(cli, [...args, "--workdir", workdir], {
    cwd: root, encoding: "utf8", stdio: capture ? ["ignore", "pipe", "inherit"] : "inherit",
  });
}
function load() {
  const env = JSON.parse(readFileSync(resolve(workdir, "env.json"), "utf8"));
  if (env.url !== "http://127.0.0.1:55421") throw new Error("Refusing non-local E2E backend.");
  return env;
}
if (command === "start") {
  mkdirSync(resolve(workdir, "supabase/migrations"), { recursive: true });
  copyFileSync(resolve(root, "e2e/supabase.config.toml"), resolve(workdir, "supabase/config.toml"));
  copyFileSync(resolve(root, "e2e/images.sql"), resolve(workdir, "supabase/migrations/202609240001_images.sql"));
  for (const file of readdirSync(resolve(root, "supabase/migrations")).filter(f => f.endsWith(".sql"))) {
    copyFileSync(resolve(root, "supabase/migrations", file), resolve(workdir, "supabase/migrations", file));
  }
  // Use the actual reviewed cleanup, not an independently maintained final schema.
  copyFileSync(resolve(root, "supabase/manual/20261002_finish_profile_cutover.sql"),
    resolve(workdir, "supabase/migrations/202610020004_finish_profile_cutover.sql"));
  copyFileSync(resolve(root, "e2e/seed.sql"), resolve(workdir, "supabase/seed.sql"));
  run(["start"], true);
  const status = JSON.parse(run(["status", "-o", "json"], true));
  if (status.API_URL !== "http://127.0.0.1:55421") throw new Error("Unexpected local API URL.");
  writeFileSync(resolve(workdir, "env.json"), JSON.stringify({
    url: status.API_URL, anonKey: status.ANON_KEY, serviceKey: status.SERVICE_ROLE_KEY,
  }, null, 2), { mode: 0o600 });
  console.log("Isolated Supabase ready. Run npm run test:e2e.");
} else if (command === "reset") {
  // Fixed workdir and --local: never linked/remote, never the user's primary database.
  load();
  run(["db", "reset", "--local"]);
} else if (command === "stop") {
  run(["stop"]);
} else if (command === "account") {
  const env = load();
  const admin = createClient(env.url, env.serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const email = `manual-${randomUUID()}@example.test`;
  const password = randomUUID();
  const { error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw error;
  console.log(`Local-only test credentials:\nEmail: ${email}\nPassword: ${password}\nOpen http://127.0.0.1:3100/login after npm run e2e:dev.`);
} else if (command === "dev") {
  const env = load();
  execFileSync(resolve(root, "node_modules/.bin/next"), ["dev", "--webpack", "--hostname", "127.0.0.1", "--port", "3100"], {
    cwd: root, stdio: "inherit", env: {
      ...process.env, E2E_AUTH_ENABLED: "true", E2E_BUILD: "true",
      NEXT_PUBLIC_SUPABASE_URL: env.url, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: env.anonKey,
    },
  });
} else throw new Error("Use start, reset, stop, account or dev.");
