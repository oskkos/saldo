import { describe, it, expect } from '@jest/globals';
import { render, screen } from '@testing-library/react';

import { ErrorMessage } from '../errorMessage';

// NextAuth reports a failed sign-in by putting a code in the query string, and this
// is the only thing that turns it into something a user can act on. The code arrives
// as whatever the URL held, so all three shapes have to be handled: absent, a single
// value, and repeated (which URLSearchParams surfaces as an array).

describe('ErrorMessage', () => {
  it('renders nothing when the sign-in did not fail', () => {
    const { container } = render(<ErrorMessage error={undefined} />);

    expect(container).toBeEmptyDOMElement();
  });

  it('says which part to correct when the credentials were rejected', () => {
    render(<ErrorMessage error="CredentialsSignin" />);

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Invalid email or password. Please try again.',
    );
  });

  it('falls back to a generic message for a code it does not recognise', () => {
    render(<ErrorMessage error="Configuration" />);

    expect(screen.getByRole('alert')).toHaveTextContent(
      'An error occurred. Please try again.',
    );
  });

  it('falls back to a generic message when the parameter repeats', () => {
    render(<ErrorMessage error={['CredentialsSignin', 'Configuration']} />);

    expect(screen.getByRole('alert')).toHaveTextContent(
      'An error occurred. Please try again.',
    );
  });
});
