import { localEnvironment } from "./env";

export default async function globalSetup() {
  const env = localEnvironment();
  try {
    const response = await fetch(env.url + "/rest/v1/images?select=id", {
      headers: { apikey: env.anonKey },
      signal: AbortSignal.timeout(5_000),
    });
    if (!response.ok) throw new Error("Local API or schema is unavailable.");
    const images = await response.json();
    if (!Array.isArray(images) || images.length !== 2) throw new Error("Gallery fixtures are missing.");
  } catch {
    throw new Error("E2E backend is not ready. Start Docker, run npm run e2e:setup, and use npm run e2e:reset if the fixture schema is stale.");
  }
}
