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

describe('credentials authorize', () => {
  type Credentials = { email: string; password: string } | undefined;
  type Authorized = { id: string; email: string; name: string } | null;

  const authorize = async (credentials: Credentials) => {
    const provider = auth.authOptions.providers[0] as unknown as {
      authorize: (c: Credentials) => Promise<Authorized>;
    };
    return provider.authorize(credentials);
  };

  it('turns a verified user into a session subject', async () => {
    const onCredentialsSignin = (await import('@/actions'))
      .onCredentialsSignin as unknown as ResolvingMock;
    onCredentialsSignin.mockResolvedValue({
      id: 7,
      email: 'auth@example.com',
      name: 'Ada',
    });

    const result = await authorize({
      email: 'auth@example.com',
      password: 'hunter2',
    });

    // next-auth requires the id as a string, and the numeric one is put back on the
    // token by the jwt callback below.
    expect(result).toEqual({
      id: '7',
      email: 'auth@example.com',
      name: 'Ada',
    });
  });

  it('refuses when the credentials do not match', async () => {
    const onCredentialsSignin = (await import('@/actions'))
      .onCredentialsSignin as unknown as ResolvingMock;
    onCredentialsSignin.mockResolvedValue(null);

    await expect(
      authorize({ email: 'auth@example.com', password: 'wrong' }),
    ).resolves.toBeNull();
  });

  it('refuses when no credentials were submitted at all', async () => {
    const onCredentialsSignin = (await import('@/actions'))
      .onCredentialsSignin as unknown as ResolvingMock;

    await expect(authorize(undefined)).resolves.toBeNull();
    // Nothing is looked up for an empty submission.
    expect(onCredentialsSignin).not.toHaveBeenCalled();
  });
});

describe('jwt callback', () => {
  type Token = { userId?: number; email?: string };

  const jwt = async (args: { token: Token; user?: unknown }) => {
    const callback = auth.authOptions.callbacks?.jwt as unknown as (
      a: unknown,
    ) => Promise<Token>;
    return callback(args);
  };

  it('provisions the user on first sign-in and records the numeric id', async () => {
    const onAfterSignin = (await import('@/actions'))
      .onAfterSignin as unknown as ResolvingMock;
    onAfterSignin.mockResolvedValue([{ id: 11 }]);

    const token = await jwt({
      token: {},
      user: { email: 'auth@example.com', name: 'Ada' },
    });

    expect(onAfterSignin).toHaveBeenCalledWith({
      email: 'auth@example.com',
      name: 'Ada',
    });
    expect(token.userId).toBe(11);
  });

  it('defaults a provider that supplies no name to an empty one', async () => {
    const onAfterSignin = (await import('@/actions'))
      .onAfterSignin as unknown as ResolvingMock;
    onAfterSignin.mockResolvedValue([{ id: 12 }]);

    await jwt({ token: {}, user: { email: 'auth@example.com', name: null } });

    expect(onAfterSignin).toHaveBeenCalledWith({
      email: 'auth@example.com',
      name: '',
    });
  });

  it('recovers the id for a token issued before it was recorded', async () => {
    const getUser = (await import('@/repository/userRepository'))
      .getUser as unknown as ResolvingMock;
    getUser.mockResolvedValue({ id: 13 });

    // A session that predates the userId claim would otherwise never resolve to a
    // user, and every repository call is gated on it.
    const token = await jwt({ token: { email: 'auth@example.com' } });

    expect(getUser).toHaveBeenCalledWith('auth@example.com');
    expect(token.userId).toBe(13);
  });

  it('leaves the token alone when the address matches no user', async () => {
    const getUser = (await import('@/repository/userRepository'))
      .getUser as unknown as ResolvingMock;
    getUser.mockResolvedValue(null);

    const token = await jwt({ token: { email: 'gone@example.com' } });

    expect(token.userId).toBeUndefined();
  });

  it('does not look anything up for a token that already knows its id', async () => {
    const getUser = (await import('@/repository/userRepository'))
      .getUser as unknown as ResolvingMock;

    const token = await jwt({ token: { userId: 14, email: 'a@example.com' } });

    expect(getUser).not.toHaveBeenCalled();
    expect(token.userId).toBe(14);
  });
});
