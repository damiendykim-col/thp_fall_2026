// Validate the services the tests actually use, rather than accepting a gateway
// response (including 401/404) as proof that its upstream services are healthy.
export async function waitForBackend(env, {
  attempts = 15,
  fetchImpl = fetch,
  sleep = ms => new Promise(resolve => setTimeout(resolve, ms)),
} = {}) {
  if (env.url !== 'http://127.0.0.1:55421' || !env.anonKey || !env.serviceKey) {
    throw new Error('Missing or non-local E2E configuration.');
  }
  const probes = [
    { name: 'Auth', path: '/auth/v1/health', key: env.anonKey, valid: data => Boolean(data?.version) },
    { name: 'REST fixtures', path: '/rest/v1/images?select=id', key: env.anonKey, valid: data => Array.isArray(data) && data.length === 2 },
    { name: 'Storage buckets', path: '/storage/v1/bucket', key: env.serviceKey, valid: data => Array.isArray(data) && ['avatars', 'challenge-images'].every(id => data.some(bucket => bucket.id === id)) },
  ];
  let failures = [];
  for (let attempt = 1; attempt <= attempts; attempt++) {
    failures = (await Promise.all(probes.map(async probe => {
      try {
        const response = await fetchImpl(env.url + probe.path, {
          headers: { apikey: probe.key, Authorization: `Bearer ${probe.key}` },
          signal: AbortSignal.timeout(3_000),
        });
        if (!response.ok) return `${probe.name}: HTTP ${response.status}`;
        return probe.valid(await response.json()) ? null : `${probe.name}: unexpected data`;
      } catch { return `${probe.name}: unavailable or invalid response`; }
    }))).filter(Boolean);
    if (!failures.length) return;
    if (attempt < attempts) await sleep(2_000);
  }
  throw new Error(`E2E backend not ready: ${failures.join('; ')}`);
}
