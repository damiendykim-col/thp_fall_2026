import { render, screen } from '@testing-library/react';
import RoundNavigation from './round-navigation';
test('round navigation uses links, never an implicit vote', () => {
  render(<RoundNavigation previous="previous" next="next" />);
  expect(screen.getByRole('link', { name: 'Next round →' })).toHaveAttribute('href', '/challenges/next');
  expect(screen.getByRole('link', { name: '← Previous round' })).toHaveAttribute('href', '/challenges/previous');
  expect(screen.queryByRole('button')).not.toBeInTheDocument();
});
