import { render, screen } from '@testing-library/react';
import SiteHeader from './site-header';
const getUser = jest.fn();
const rpc = jest.fn();
jest.mock('@/lib/supabase/server', () => ({ createAuthClient: async () => ({ auth: { getUser }, rpc }) }));
jest.mock('@/lib/performance', () => ({ measureOperation: (_: string, f: () => unknown) => f() }));
jest.mock('./sign-out', () => ({ __esModule: true, default: () => <button>Sign out</button> }));
beforeEach(() => { jest.clearAllMocks(); rpc.mockResolvedValue({ data: false }); });
test('visitors see challenge navigation and sign in without a competing creation action', async () => {
  getUser.mockResolvedValue({ data: { user: null } });
  render(await SiteHeader());
  expect(screen.getByRole('link', { name: 'Challenges' })).toHaveAttribute('href', '/challenges');
  expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/login');
  expect(screen.queryByRole('link', { name: 'Create challenge' })).not.toBeInTheDocument();
  expect(screen.queryByRole('link', { name: 'Images' })).not.toBeInTheDocument();
  expect(screen.queryByRole('link', { name: 'Members' })).not.toBeInTheDocument();
});
test('profile and role-specific moderation live in a collapsed account menu', async () => {
  getUser.mockResolvedValue({ data: { user: { id: 'user' } } });
  rpc.mockResolvedValue({ data: true });
  render(await SiteHeader());
  expect(screen.queryByRole('link', { name: 'Create challenge' })).not.toBeInTheDocument();
  const menu = screen.getByText('Account').closest('details')!;
  expect(menu).not.toHaveAttribute('open');
  expect(menu.querySelector('a[href="/profile"]')).toBeTruthy();
  expect(menu.querySelector('a[href="/moderation"]')).toBeTruthy();
});
