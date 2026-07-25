import {
  describe,
  it,
  expect,
  jest,
  beforeAll,
  beforeEach,
} from '@jest/globals';

// next-auth's entry pulls in ESM-only openid-client, so getServerSession is
// mocked at the module boundary. The actions module is mocked too because
// authOptions imports it for the credentials provider.
jest.mock('next-auth', () => ({ getServerSession: jest.fn() }));
jest.mock('next-auth/providers/google', () => ({
  __esModule: true,
  default: () => ({ id: 'google' }),
}));
jest.mock('next-auth/providers/github', () => ({
  __esModule: true,
  default: () => ({ id: 'github' }),
}));
jest.mock('next-auth/providers/credentials', () => ({
  __esModule: true,
  default: (config: unknown) => config,
}));
jest.mock('@/actions', () => ({
  onAfterSignin: jest.fn(),
  onCredentialsSignin: jest.fn(),
}));
jest.mock('@/repository/userRepository', () => ({ getUser: jest.fn() }));

type AuthSession = typeof import('@/auth/authSession');
type ResolvingMock = jest.Mock<(...args: unknown[]) => Promise<unknown>>;

let auth: AuthSession;
let getServerSession: ResolvingMock;

beforeAll(async () => {
  auth = await import('@/auth/authSession');
  getServerSession = (await import('next-auth'))
    .getServerSession as unknown as ResolvingMock;
});

beforeEach(() => {
  jest.clearAllMocks();
});

describe('getUserFromSession', () => {
  // @scenario auth/Id surfaced on the session
  it('reads the numeric database id off the session', async () => {
    getServerSession.mockResolvedValue({
      user: { email: 'auth@example.com', name: 'Auth Tester', id: 42 },
    });

    await expect(auth.getUserFromSession()).resolves.toEqual({
      id: 42,
      email: 'auth@example.com',
      name: 'Auth Tester',
    });
  });

  // @scenario auth/Incomplete session
  it('treats a session with no email as unauthenticated', async () => {
    getServerSession.mockResolvedValue({ user: { id: 42 } });

    await expect(auth.getUserFromSession()).resolves.toBeNull();
  });

  // @scenario auth/Incomplete session
  it('treats a non-numeric id as unauthenticated', async () => {
    // A string id is what the provider hands back before the jwt callback
    // converts it; callers must not accept that as authenticated.
    getServerSession.mockResolvedValue({
      user: { email: 'auth@example.com', id: '42' },
    });

    await expect(auth.getUserFromSession()).resolves.toBeNull();
  });

  // @scenario auth/Incomplete session
  it('treats a missing session as unauthenticated', async () => {
    getServerSession.mockResolvedValue(null);

    await expect(auth.getUserFromSession()).resolves.toBeNull();
  });

  it('defaults a missing name to an empty string', async () => {
    getServerSession.mockResolvedValue({
      user: { email: 'auth@example.com', id: 42 },
    });

    await expect(auth.getUserFromSession()).resolves.toEqual({
      id: 42,
      email: 'auth@example.com',
      name: '',
    });
  });
});

describe('session callback', () => {
  // @scenario auth/Id surfaced on the session
  it('copies the numeric id from the token onto the session user', async () => {
    const session = { user: { email: 'auth@example.com' } };

    const sessionCallback = auth.authOptions.callbacks?.session as unknown as (
      args: unknown,
    ) => Promise<{ user: { id?: number } }>;

    const result = await sessionCallback({ session, token: { userId: 42 } });

    expect(result.user.id).toBe(42);
  });
});
