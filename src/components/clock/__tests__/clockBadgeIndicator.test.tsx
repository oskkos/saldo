import { describe, expect, it } from '@jest/globals';
import { render, screen } from '@testing-library/react';

import ClockBadgeIndicator from '../clockBadgeIndicator';

// The indicator is how someone who wandered away from the home page knows they are
// still clocked in. Both answers matter: showing it when there is no session would
// be a false alarm, and hiding it during one loses hours.

describe('ClockBadgeIndicator', () => {
  it('shows nothing when the clock is not running', () => {
    const { container } = render(<ClockBadgeIndicator activeSession={null} />);

    expect(container).toBeEmptyDOMElement();
  });

  it('offers a way back to the clock while a session is open', () => {
    render(
      <ClockBadgeIndicator
        activeSession={{ startedAt: new Date('2026-07-26T08:00:00Z') }}
      />,
    );

    const link = screen.getByTitle('Clocked in');
    expect(link).toHaveAttribute('href', '/');
  });
});
