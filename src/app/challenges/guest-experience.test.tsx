import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import GuestExperience from './guest-experience';

test('switching panels preserves practice and the reveal opens sign-in in place', async () => {
  render(<GuestExperience signIn={<button>Continue with Google</button>} />);
  fireEvent.click(screen.getByRole('button', { name: 'Use this image' }));
  fireEvent.change(screen.getByLabelText('Your caption'), { target: { value: 'My practice caption' } });
  fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
  expect(screen.getByRole('button', { name: 'Continue with Google' })).toBeVisible();
  expect(screen.queryByRole('textbox', { name: 'Your caption' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Practice round' }));
  expect(screen.getByLabelText('Your caption')).toHaveValue('My practice caption');
  fireEvent.click(screen.getByRole('button', { name: 'Meet your opponent' }));
  fireEvent.click(screen.getByRole('button', { name: 'Try voting' }));
  fireEvent.click(screen.getByRole('button', { name: /Caption 1/ }));
  fireEvent.click(screen.getByRole('button', { name: 'Preview the reveal' }));
  fireEvent.click(screen.getByRole('button', { name: 'Start a real challenge' }));
  expect(screen.getByRole('button', { name: 'Sign in' })).toHaveAttribute('aria-pressed', 'true');
  await waitFor(() => expect(screen.getByRole('heading', { name: 'Ready for a real round?' })).toHaveFocus());
});
