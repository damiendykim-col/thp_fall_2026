/** @jest-environment node */
import { createServerClient } from '@supabase/ssr';
import { createAuthClient } from './server';
jest.mock('@supabase/ssr', () => ({ createServerClient: jest.fn() }));
const set = jest.fn();
jest.mock('next/headers', () => ({ cookies: async () => ({ getAll: () => [], set }) }));

test('callback cookie write errors are surfaced instead of silently losing the session', async () => {
  const oldUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const oldKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'test';
  try {
    set.mockImplementation(() => { throw new Error('Cookie write failed'); });
    await createAuthClient({ writableCookies: true });
    const options = jest.mocked(createServerClient).mock.calls.at(-1)![2]!;
    const write = () => options.cookies!.setAll!([{ name: 'session', value: 'secret', options: {} }], {});
    expect(write).toThrow('Cookie write failed');
  } finally {
    if (oldUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL; else process.env.NEXT_PUBLIC_SUPABASE_URL = oldUrl;
    if (oldKey === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY; else process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = oldKey;
  }
});
