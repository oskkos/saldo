import { describe, expect, it } from '@jest/globals';
import { render, screen } from '@testing-library/react';

import { errorToastMessage } from '../errorToast';

// This is what every failed write shows the user. The browser suite never makes a
// write fail, so neither branch here has been exercised before.

describe('errorToastMessage', () => {
  it('includes the reason when the failure carries one', () => {
    render(<>{errorToastMessage('Failed to save', new Error('conflict'))}</>);

    expect(screen.getByText('Failed to save')).toBeInTheDocument();
    expect(screen.getByText('conflict')).toBeInTheDocument();
  });

  it('shows the title alone when what was thrown is not an Error', () => {
    const { container } = render(
      <>{errorToastMessage('Failed to save', 'a bare string')}</>,
    );

    expect(screen.getByText('Failed to save')).toBeInTheDocument();
    // Nothing is invented for a throw that carries no message.
    expect(container).not.toHaveTextContent('a bare string');
  });
});
