// Fixed internal destinations only. Never accept arbitrary redirect URLs.
export function authDestination(value: unknown): string {
  return typeof value === 'string' && /^\/challenges(?:\/(?:new|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}))?$/i.test(value)
    ? value : '/challenges';
}
