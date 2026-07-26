import {
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import { render, screen } from '@testing-library/react';

// Signin is an async server component: it is awaited and the returned element
// rendered, as in the statistics page test.
//
// The auth module is mocked because its next-auth import would otherwise pull in
// the ESM-only openid-client, and the two sign-in panels are stubbed because what
// is under test here is the redirect guard and the error surfaced from the URL.
jest.mock('@/auth/authSession', () => ({ getSession: jest.fn() }));
jest.mock('next/navigation', () => ({ redirect: jest.fn() }));
jest.mock('../oauthSignin', () => ({ OAuthSignin: () => null }));
jest.mock('../credentialsSignin', () => ({ CredentialsSignin: () => null }));

type SessionMock = jest.Mock<() => Promise<unknown>>;
type RedirectMock = jest.Mock<(url: string) => void>;
type SearchParams = { [key: string]: string | string[] | undefined };

let Signin: (props: {
  searchParams: Promise<SearchParams>;
}) => Promise<React.ReactElement>;
let getSession: SessionMock;
let redirect: RedirectMock;

beforeAll(async () => {
  Signin = (await import('../page')).default;
  getSession = (await import('@/auth/authSession'))
    .getSession as unknown as SessionMock;
  redirect = (await import('next/navigation'))
    .redirect as unknown as RedirectMock;
});

beforeEach(() => {
  getSession.mockReset();
  redirect.mockReset();
});

const renderSignin = async (searchParams: SearchParams = {}) => {
  const element = await Signin({ searchParams: Promise.resolve(searchParams) });
  return render(element);
};

describe('Signin page', () => {
  it('sends an already signed-in visitor to the app', async () => {
    getSession.mockResolvedValue({ user: { id: 1 } });

    await renderSignin();

    expect(redirect).toHaveBeenCalledWith('/');
  });

  it('explains a failed attempt reported in the query string', async () => {
    getSession.mockResolvedValue(null);

    await renderSignin({ error: 'CredentialsSignin' });

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Invalid email or password. Please try again.',
    );
    expect(redirect).not.toHaveBeenCalled();
  });

  it('shows no alert on a first visit', async () => {
    getSession.mockResolvedValue(null);

    await renderSignin();

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
