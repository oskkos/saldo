import {
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Session } from 'next-auth';

// The signed-in corner of the navbar. Its two jobs are showing who is signed in —
// an OAuth avatar where there is one, a placeholder icon otherwise — and signing
// out. next-auth/react is mocked because its real entry pulls in the ESM-only
// openid-client.
jest.mock('next-auth/react', () => ({ signOut: jest.fn() }));

type SignOutMock = jest.Mock<() => Promise<unknown>>;

let AuthActions: typeof import('../authActions').default;
let signOut: SignOutMock;

beforeAll(async () => {
  AuthActions = (await import('../authActions')).default;
  signOut = (await import('next-auth/react')).signOut as unknown as SignOutMock;
});

const session = (user: {
  name?: string | null;
  image?: string | null;
}): Session => ({ user, expires: '2099-01-01T00:00:00Z' }) as Session;

beforeEach(() => {
  signOut.mockReset();
});

describe('AuthActions', () => {
  it('shows the profile picture a provider supplied', () => {
    render(
      <AuthActions
        session={session({
          name: 'Ada',
          image: 'https://example.com/ada.png',
        })}
        className="icon"
      />,
    );

    expect(screen.getByAltText('Profile picture')).toBeInTheDocument();
    expect(screen.getByTitle('Ada')).toBeInTheDocument();
  });

  it('falls back to a placeholder for an account with no picture', () => {
    render(
      <AuthActions
        session={session({ name: 'Ada', image: null })}
        className="icon"
      />,
    );

    expect(screen.queryByAltText('Profile picture')).not.toBeInTheDocument();
    expect(screen.getByTitle('Ada')).toBeInTheDocument();
  });

  it('tolerates an account with no name', () => {
    render(
      <AuthActions
        session={session({ name: null, image: null })}
        className="icon"
      />,
    );

    // The nullish coalescing matters: without it the literal "null" would appear as
    // the tooltip next to the sign-out control.
    expect(screen.queryByTitle('null')).not.toBeInTheDocument();
    expect(screen.getByTitle('Sign out')).toBeInTheDocument();
  });

  it('signs out when asked', async () => {
    render(
      <AuthActions
        session={session({ name: 'Ada', image: null })}
        className="icon"
      />,
    );

    await userEvent.setup().click(screen.getByTitle('Sign out'));

    expect(signOut).toHaveBeenCalled();
  });
});
