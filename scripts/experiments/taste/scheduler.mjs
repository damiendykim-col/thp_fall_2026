export const LIMITS = {
  labels: { rpm: 10, tpm: 200000, allowance: 200 },
  embedding: { rpm: 60, tpm: 24000, allowance: 500 },
};

// Conservative local estimate, not provider tokenization or a project-wide quota.
export function tokenReservation(options) {
  const body = options.body ?? '';
  let output = 0;
  try { output = JSON.parse(body).generationConfig?.maxOutputTokens ?? 0; } catch { /* test/empty payload */ }
  return Math.max(1, Buffer.byteLength(body, 'utf8') + output);
}

export function createScheduler(state, { maxRequests = 80, limits = LIMITS,
  now = Date.now, sleep = ms => new Promise(resolve => setTimeout(resolve, ms)),
  checkpoint = () => {}, log = () => {} } = {}) {
  if (!Number.isInteger(maxRequests) || maxRequests < 1 || !Array.isArray(state.attempts)) throw new Error('Invalid scheduler budget/state');
  for (const limit of Object.values(limits)) {
    if (![limit.rpm, limit.tpm, limit.allowance].every(n => Number.isInteger(n) && n > 0)) throw new Error('Invalid model limits');
  }
  async function reserve(kind, tokens) {
    const limit = limits[kind];
    if (!limit) throw new Error('Unknown provider role');
    if (tokens > limit.tpm) throw new Error('Request exceeds configured token reservation limit');
    if (state.attempts.length >= maxRequests) throw new Error('Total request budget exhausted; completed results are saved');
    const history = state.attempts.filter(event => event.kind === kind);
    // A job allowance never resets on resume or at midnight. Other app usage is unknown.
    if (history.length >= limit.allowance) throw new Error(`${kind} job allowance exhausted`);
    while (true) {
      const time = now();
      const recent = history.filter(event => time - event.at < 60000);
      const last = history.at(-1);
      let wait = last ? Math.max(0, last.at + Math.ceil(60000 / limit.rpm) - time) : 0;
      if (recent.length >= limit.rpm || recent.reduce((sum, event) => sum + event.tokens, 0) + tokens > limit.tpm) {
        wait = Math.max(wait, recent[0].at + 60000 - time);
      }
      if (wait <= 0) break;
      log(`Waiting ${Math.ceil(wait / 1000)}s for ${kind} pacing`);
      await sleep(wait);
    }
    const event = { kind, at: now(), tokens, status: 'pending' };
    state.attempts.push(event);
    await checkpoint(); // Persist before sending: interruptions still consume the budget.
    return event;
  }
  return { fetch: kind => async (url, options = {}, fetcher = fetch) => {
    for (let attempt = 0; attempt < 3; attempt++) {
      const event = await reserve(kind, tokenReservation(options));
      let response;
      try {
        // Provider helpers create their timeout before pacing; start a fresh one at send.
        response = await fetcher(url, { ...options, signal: AbortSignal.timeout(30000) });
        event.status = response.status;
      } catch {
        event.status = 'network-error';
        await checkpoint();
        throw new Error(`${kind} network failure; no automatic retry because completion is unknown`);
      }
      await checkpoint();
      if (![429, 500, 502, 503, 504].includes(response.status) || attempt === 2) return response;
      const header = response.headers?.get('retry-after');
      const seconds = header && /^\d+(\.\d+)?$/.test(header) ? Number(header) * 1000 : Date.parse(header);
      const retryAfter = header && Number.isFinite(seconds) ? (/^\d+(\.\d+)?$/.test(header) ? seconds : Math.max(0, seconds - now())) : 0;
      const delay = Math.max(60000 * (attempt + 1), retryAfter);
      if (delay > 300000) return response; // Stop instead of ignoring a long server cooldown.
      await response.body?.cancel();
      log(`${kind} HTTP ${response.status}; retry ${attempt + 1}/2 after ${Math.ceil(delay / 1000)}s`);
      await sleep(delay);
    }
  } };
}
