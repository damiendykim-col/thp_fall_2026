import { authDestination } from './auth-destination';

test('preserves only known challenge destinations', () => {
  expect(authDestination('/challenges/new')).toBe('/challenges/new');
  expect(authDestination('/challenges/12345678-1234-1234-1234-123456789abc')).toBe('/challenges/12345678-1234-1234-1234-123456789abc');
  for (const path of [undefined, '//evil.test', 'https://evil.test', '/profile', '/challenges/new?next=https://evil.test', '/challenges/../../admin']) {
    expect(authDestination(path)).toBe('/challenges');
  }
});
