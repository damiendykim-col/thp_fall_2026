import 'server-only';

// Never serialize provider errors, request URLs, credentials, or user content.
export function logOperation(operation: string, outcome: 'succeeded' | 'rejected' | 'failed', error?: unknown) {
  const candidate = error && typeof error === 'object' && 'code' in error ? error.code : undefined;
  const code = typeof candidate === 'string' && /^[A-Za-z0-9_]{1,64}$/.test(candidate) ? candidate : undefined;
  const entry = { event: 'app-operation', operation, outcome, ...(code ? { code } : {}) };
  if (outcome === 'failed') console.error(entry);
  else console.info(entry);
}
