import { describe, expect, it } from '@jest/globals';
import { render, screen } from '@testing-library/react';

import Message from '../message';

// Every success and failure in the login flows is shown through this component, and
// only the happy path is ever rendered by the browser suite — the error styling and
// the optional description are reached by nothing else.

describe('Message', () => {
  it('announces itself to assistive technology', () => {
    render(<Message type="success" title="Saved" />);

    expect(screen.getByRole('alert')).toHaveTextContent('Saved');
  });

  it('styles success and error differently', () => {
    const { unmount } = render(<Message type="success" title="Saved" />);
    expect(screen.getByRole('alert')).toHaveClass('alert-success');
    unmount();

    render(<Message type="error" title="Failed" />);
    expect(screen.getByRole('alert')).toHaveClass('alert-error');
  });

  it('renders a description only when given one', () => {
    const { unmount } = render(<Message type="error" title="Failed" />);
    expect(screen.getByRole('alert')).toHaveTextContent('Failed');
    unmount();

    render(
      <Message type="error" title="Failed" description="The server said no" />,
    );
    expect(screen.getByText('The server said no')).toBeInTheDocument();
  });

  it('lets the caller supply its own icon', () => {
    render(
      <Message
        type="success"
        title="Saved"
        icon={<span data-testid="caller-icon" />}
      />,
    );

    expect(screen.getByTestId('caller-icon')).toBeInTheDocument();
  });
});
