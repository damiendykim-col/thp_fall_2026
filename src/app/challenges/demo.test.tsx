import { render, screen, fireEvent } from '@testing-library/react';
import ChallengeDemo from './demo';
const click = (name: string) => fireEvent.click(screen.getByRole('button', { name }));
function writeCaption() {
  click('Use this image');
  fireEvent.change(screen.getByLabelText('Your caption'), { target: { value: 'I put the I in team.' } });
  click('Meet your opponent');
}
test('practice walks through creation, voting, reveal, and sign-in without pretending to record community votes', () => {
  render(<ChallengeDemo />);
  writeCaption();
  expect(screen.getByText(/Prepared example/)).toBeVisible();
  click('Try voting');
  expect(screen.queryByText('Your caption')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Preview the reveal' })).toBeDisabled();
  click('Caption 1 I put the I in team.');
  click('Preview the reveal');
  expect(screen.getByText('Your caption')).toBeVisible();
  expect(screen.getByText(/No community votes/)).toBeVisible();
  expect(screen.getByRole('link', { name: 'Start a real challenge' })).toHaveAttribute('href', '/login?next=%2Fchallenges%2Fnew');
  click('Restart practice');
  click('Use this image');
  expect(screen.getByLabelText('Your caption')).toHaveValue('');
});
test('suggestions, back navigation, changing images and undoing a pick work', () => {
  render(<ChallengeDemo signedIn />);
  click('Rainy commute');
  click('Use this image');
  expect(screen.getByRole('button', { name: 'Meet your opponent' })).toBeDisabled();
  click('Suggest a caption');
  click('Meet your opponent');
  click('Try voting');
  const option = screen.getByRole('button', { name: /Caption 1/ });
  fireEvent.click(option);
  fireEvent.click(option);
  expect(screen.getByRole('button', { name: 'Preview the reveal' })).toBeDisabled();
  click('Back'); click('Back');
  expect(screen.getByLabelText('Your caption')).not.toHaveValue('');
  click('Back'); click('Group project'); click('Use this image');
  expect(screen.getByLabelText('Your caption')).toHaveValue('');
});
