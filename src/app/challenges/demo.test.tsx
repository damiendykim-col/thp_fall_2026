import { render, screen, fireEvent } from '@testing-library/react';
import ChallengeDemo from './demo';
test('visitors can write a contender and reveal illustrative roles without a live generation', () => {
  render(<ChallengeDemo />);
  fireEvent.change(screen.getByLabelText('Try your own caption'), { target: { value: 'I put the I in team.' } });
  expect(screen.queryByText('Example AI opponent')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: /Caption 1/ }));
  fireEvent.click(screen.getByRole('button', { name: 'Reveal demo roles' }));
  expect(screen.getByText('Example AI opponent')).toBeVisible();
  expect(screen.getByText('Your contender')).toBeVisible();
  expect(screen.getByText(/No live AI generation or votes/)).toBeVisible();
  fireEvent.change(screen.getByLabelText('Try your own caption'), { target: { value: 'Changed my mind.' } });
  expect(screen.queryByText('Example AI opponent')).not.toBeInTheDocument();
});
