import {
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// The two ways into the app. Each hands off to next-auth's signIn, and which
// provider id it passes is the whole of its logic — 'google' where the button says
// GitHub would send people to the wrong account. The credentials form also refuses
// to call signIn at all until both fields are filled.
//
// next-auth/react is mocked because its real entry pulls in the ESM-only
// openid-client, which Jest cannot load.
jest.mock('next-auth/react', () => ({ signIn: jest.fn() }));

type SignInMock = jest.Mock<
  (provider: string, options?: Record<string, unknown>) => Promise<unknown>
>;

let CredentialsSignin: typeof import('../credentialsSignin').CredentialsSignin;
let OAuthSignin: typeof import('../oauthSignin').OAuthSignin;
let signIn: SignInMock;

beforeAll(async () => {
  CredentialsSignin = (await import('../credentialsSignin')).CredentialsSignin;
  OAuthSignin = (await import('../oauthSignin')).OAuthSignin;
  signIn = (await import('next-auth/react')).signIn as unknown as SignInMock;
});

beforeEach(() => {
  signIn.mockReset();
});

describe('OAuthSignin', () => {
  it.each([
    ['Google', 'google'],
    ['GitHub', 'github'],
  ])('signs in with %s through the matching provider', async (name, id) => {
    render(<OAuthSignin />);

    await userEvent
      .setup()
      // The accessible name also carries the logo's alt text, so this matches on the
      // label rather than the whole string.
      .click(
        screen.getByRole('button', {
          name: new RegExp(`Sign in with ${name}`),
        }),
      );

    expect(signIn).toHaveBeenCalledWith(id);
  });
});

describe('CredentialsSignin', () => {
  beforeEach(() => {
    render(<CredentialsSignin />);
  });

  it('offers a way out for someone who forgot their password', () => {
    expect(
      screen.getByRole('link', { name: 'Forgot password?' }),
    ).toHaveAttribute('href', '/forgot-password');
  });

  it('signs in with what was typed', async () => {
    const user = userEvent.setup();
    await user.type(screen.getByPlaceholderText('Email'), 'ada@example.com');
    await user.type(screen.getByPlaceholderText('Password'), 'hunter2');

    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    await waitFor(() =>
      expect(signIn).toHaveBeenCalledWith('credentials', {
        email: 'ada@example.com',
        password: 'hunter2',
      }),
    );
  });

  it('does not attempt a sign-in with an empty form', async () => {
    await userEvent
      .setup()
      .click(screen.getByRole('button', { name: 'Sign in' }));

    await waitFor(() => expect(signIn).not.toHaveBeenCalled());
  });
});
