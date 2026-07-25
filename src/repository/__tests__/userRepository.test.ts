import {
  describe,
  it,
  expect,
  jest,
  beforeAll,
  beforeEach,
} from '@jest/globals';
import bcrypt from 'bcrypt';
import { createHash } from 'node:crypto';

// Same server-layer harness as clockRepository.test.ts. bcrypt is left real so
// the hashing claims are asserted against actual hashes rather than a stub.
jest.mock('@sentry/nextjs', () => ({
  startSpan: (_opts: unknown, cb: () => unknown) => cb(),
}));
jest.mock('react', () => ({
  ...(jest.requireActual('react') as object),
  cache: (fn: unknown) => fn,
}));
jest.mock('@/repository/prisma', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      upsert: jest.fn(),
    },
    passwordResetData: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
      delete: jest.fn(),
    },
  },
}));

type UserRepo = typeof import('@/repository/userRepository');
type ResolvingMock = jest.Mock<(...args: unknown[]) => Promise<unknown>>;
type PrismaMock = {
  user: {
    findUnique: ResolvingMock;
    create: ResolvingMock;
    update: ResolvingMock;
    upsert: ResolvingMock;
  };
  passwordResetData: {
    findUnique: ResolvingMock;
    upsert: ResolvingMock;
    delete: ResolvingMock;
  };
};

let repo: UserRepo;
let db: PrismaMock;

const EMAIL = 'auth@example.com';
const userRow = (overrides: Record<string, unknown> = {}) => ({
  id: 42,
  email: EMAIL,
  name: 'Auth Tester',
  password: null,
  ...overrides,
});

beforeAll(async () => {
  repo = await import('@/repository/userRepository');
  db = (await import('@/repository/prisma')).prisma as unknown as PrismaMock;
});

beforeEach(() => {
  jest.clearAllMocks();
});

describe('getUserByEmailAndPassword', () => {
  // @scenario auth/Correct credentials
  it('returns the user when the password matches the stored hash', async () => {
    const password = 'correct-horse';
    db.user.findUnique.mockResolvedValue(
      userRow({ password: await bcrypt.hash(password, 10) }),
    );

    await expect(
      repo.getUserByEmailAndPassword(EMAIL, password),
    ).resolves.toEqual({ id: 42, email: EMAIL, name: 'Auth Tester' });
  });

  // @scenario auth/Wrong password or unknown email
  it('returns no user when the email is unknown', async () => {
    db.user.findUnique.mockResolvedValue(null);

    await expect(
      repo.getUserByEmailAndPassword('nobody@example.com', 'whatever'),
    ).resolves.toBeNull();
  });

  // @scenario auth/Wrong password or unknown email
  it('returns no user when the account has no stored password', async () => {
    // OAuth-provisioned accounts have no password, so credentials can never
    // authenticate them.
    db.user.findUnique.mockResolvedValue(userRow({ password: null }));

    await expect(
      repo.getUserByEmailAndPassword(EMAIL, 'whatever'),
    ).resolves.toBeNull();
  });

  // @scenario auth/Wrong password or unknown email
  it('does not return a user when the password does not match', async () => {
    db.user.findUnique.mockResolvedValue(
      userRow({ password: await bcrypt.hash('the-real-one', 10) }),
    );

    // The repository signals a mismatch by throwing; onCredentialsSignin turns
    // that into "no user". Either way no user is returned.
    await expect(
      repo.getUserByEmailAndPassword(EMAIL, 'wrong'),
    ).rejects.toThrow('Invalid password');
  });
});

describe('upsertUser', () => {
  // @scenario auth/First OAuth sign-in provisions the account
  it('provisions an account for the email with no stored password', async () => {
    db.user.upsert.mockResolvedValue(userRow());

    const user = await repo.upsertUser(EMAIL, 'Auth Tester');

    expect(db.user.upsert).toHaveBeenCalledWith({
      where: { email: EMAIL },
      create: { email: EMAIL, name: 'Auth Tester' },
      update: { name: 'Auth Tester' },
    });
    // The create branch sets no password field at all.
    const call = db.user.upsert.mock.calls[0][0] as {
      create: Record<string, unknown>;
    };
    expect(call.create).not.toHaveProperty('password');
    expect(user).toEqual({ id: 42, email: EMAIL, name: 'Auth Tester' });
  });

  // @scenario auth/Returning user
  it('upserts a returning user rather than creating a second account', async () => {
    db.user.upsert.mockResolvedValue(userRow({ name: 'Renamed' }));

    await repo.upsertUser(EMAIL, 'Renamed');

    expect(db.user.create).not.toHaveBeenCalled();
    const call = db.user.upsert.mock.calls[0][0] as { where: unknown };
    expect(call.where).toEqual({ email: EMAIL });
  });
});

describe('signupUser', () => {
  // @scenario auth/Valid sign-up
  it('creates the user with a bcrypt hash of the password', async () => {
    db.user.findUnique.mockResolvedValue(null);
    db.user.create.mockResolvedValue(userRow());

    await repo.signupUser({
      email: EMAIL,
      name: 'Auth Tester',
      password: 'a-good-password',
    });

    const call = db.user.create.mock.calls[0][0] as {
      data: { password: string };
    };
    expect(call.data.password).not.toBe('a-good-password');
    await expect(
      bcrypt.compare('a-good-password', call.data.password),
    ).resolves.toBe(true);
  });

  // @scenario auth/Duplicate email
  it('fails when the email is already registered', async () => {
    db.user.findUnique.mockResolvedValue(userRow());

    await expect(
      repo.signupUser({
        email: EMAIL,
        name: 'Auth Tester',
        password: 'a-good-password',
      }),
    ).rejects.toThrow('User already exists.');
    expect(db.user.create).not.toHaveBeenCalled();
  });
});

describe('password reset tokens', () => {
  // @scenario auth/Known email
  it('stores the token hashed with an expiry one hour out', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-03-04T10:00:00.000Z').getTime());
    db.passwordResetData.upsert.mockResolvedValue({});

    await repo.upsertPasswordResetData(42, 'raw-token');

    const call = db.passwordResetData.upsert.mock.calls[0][0] as {
      create: { token: string; expires_at: Date };
    };
    // The raw token never reaches the database.
    expect(call.create.token).toBe(
      createHash('sha256').update('raw-token').digest('hex'),
    );
    expect(call.create.token).not.toBe('raw-token');
    expect(call.create.expires_at.toISOString()).toBe(
      '2026-03-04T11:00:00.000Z',
    );
    jest.useRealTimers();
  });

  // @scenario auth/Valid token
  it('updates the password and consumes the token', async () => {
    db.passwordResetData.findUnique.mockResolvedValue({ user: userRow() });
    db.user.update.mockResolvedValue(userRow());
    db.passwordResetData.delete.mockResolvedValue({});

    await repo.updatePasswordByResetToken('raw-token', 'brand-new-pass');

    const update = db.user.update.mock.calls[0][0] as {
      data: { password: string };
    };
    await expect(
      bcrypt.compare('brand-new-pass', update.data.password),
    ).resolves.toBe(true);
    expect(db.passwordResetData.delete).toHaveBeenCalledWith({
      where: { user_id: 42 },
    });
  });

  // @scenario auth/Expired or unknown token
  it('changes no password when the token is expired or unknown', async () => {
    // The lookup filters on expires_at > now, so an expired token resolves to
    // nothing — the same path as a token that never existed.
    db.passwordResetData.findUnique.mockResolvedValue(null);

    await expect(
      repo.updatePasswordByResetToken('stale-token', 'brand-new-pass'),
    ).rejects.toThrow('Invalid token');
    expect(db.user.update).not.toHaveBeenCalled();
    expect(db.passwordResetData.delete).not.toHaveBeenCalled();
  });

  it('looks the token up by its hash and only while unexpired', async () => {
    db.passwordResetData.findUnique.mockResolvedValue(null);

    await repo.getUserByPasswordResetToken('raw-token');

    const call = db.passwordResetData.findUnique.mock.calls[0][0] as {
      where: { token: string; expires_at: { gt: Date } };
    };
    expect(call.where.token).toBe(
      createHash('sha256').update('raw-token').digest('hex'),
    );
    expect(call.where.expires_at.gt).toBeInstanceOf(Date);
  });
});
