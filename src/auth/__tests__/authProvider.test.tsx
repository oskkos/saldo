import { beforeAll, describe, expect, it, jest } from '@jest/globals';
import { render, screen } from '@testing-library/react';
import type { Session } from 'next-auth';

// AuthProvider is the root wrapper every page renders inside: it hands the session to
// next-auth's provider and puts the toast context around the tree. If either were
// dropped, every page would still render while useSession and every toast silently
// stopped working — so what is asserted is that both wrappers are present and the
// session reaches the one that needs it.
//
// SessionProvider is stubbed to report the session it was given; the real one pulls
// in the ESM-only openid-client.
jest.mock('next-auth/react', () => ({
  SessionProvider: ({
    session,
    children,
  }: {
    session: unknown;
    children: React.ReactNode;
  }) => (
    <div data-testid="session-provider" data-session={JSON.stringify(session)}>
      {children}
    </div>
  ),
}));

let AuthProvider: typeof import('../authProvider').AuthProvider;

beforeAll(async () => {
  AuthProvider = (await import('../authProvider')).AuthProvider;
});

const session = { user: { email: 'ada@example.com' } } as Session;

describe('AuthProvider', () => {
  it('passes the session down and renders the page inside it', () => {
    render(
      <AuthProvider session={session}>
        <p>page</p>
      </AuthProvider>,
    );

    expect(screen.getByTestId('session-provider')).toHaveAttribute(
      'data-session',
      JSON.stringify(session),
    );
    expect(screen.getByText('page')).toBeInTheDocument();
  });

  it('still wraps the tree for a signed-out visitor', () => {
    render(
      <AuthProvider session={null}>
        <p>signin page</p>
      </AuthProvider>,
    );

    expect(screen.getByTestId('session-provider')).toHaveAttribute(
      'data-session',
      'null',
    );
    expect(screen.getByText('signin page')).toBeInTheDocument();
  });

  it('renders without children', () => {
    render(<AuthProvider session={null} />);

    expect(screen.getByTestId('session-provider')).toBeInTheDocument();
  });
});
