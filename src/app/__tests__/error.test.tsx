import { describe, expect, it } from '@jest/globals';
import { render, screen } from '@testing-library/react';

import GlobalError from '../error';

// The error boundary is what a user sees when a page throws, so it is the one screen
// that must not itself be broken. Nothing else renders it: no test deliberately
// throws from a page, and no browser journey can.

describe('GlobalError', () => {
  it('explains what happened and gives the code to quote', () => {
    render(
      <GlobalError
        error={Object.assign(new Error('settings failed to load'), {
          digest: 12345,
        })}
      />,
    );

    expect(
      screen.getByText('Oops, something just went sideways'),
    ).toBeInTheDocument();
    expect(screen.getByText('settings failed to load')).toBeInTheDocument();
    // The digest is the only handle on the server-side log entry.
    expect(screen.getByText(/12345/)).toBeInTheDocument();
  });
});
