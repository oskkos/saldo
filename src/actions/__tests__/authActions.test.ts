import {
  describe,
  it,
  expect,
  jest,
  beforeAll,
  beforeEach,
} from '@jest/globals';
import type { SignupData } from '@/schemas/signupSchema';

jest.mock('@/repository/worklogRepository', () => ({
  insertWorklog: jest.fn(),
  updateWorklog: jest.fn(),
  deleteWorklog: jest.fn(),
  getWorklogs: jest.fn(),
}));
jest.mock('@/repository/clockRepository', () => ({
  clockIn: jest.fn(),
  clockOutWithWorklog: jest.fn(),
  clearSession: jest.fn(),
  getActiveSession: jest.fn(),
}));
jest.mock('@/repository/settingsRepository', () => ({
  getSettings: jest.fn(),
  upsertSettings: jest.fn(),
  insertSettings: jest.fn(),
}));
jest.mock('@/repository/userRepository', () => ({
  getUser: jest.fn(),
  getUserByEmailAndPassword: jest.fn(),
  upsertUser: jest.fn(),
  signupUser: jest.fn(),
  upsertPasswordResetData: jest.fn(),
  getUserByPasswordResetToken: jest.fn(),
  updatePasswordByResetToken: jest.fn(),
}));
jest.mock('@/repository/expectedHoursOverrideRepository', () => ({
  getExpectedHoursOverrides: jest.fn(),
  upsertExpectedHoursOverride: jest.fn(),
  deleteExpectedHoursOverride: jest.fn(),
}));
jest.mock('@/services/forgotPasswordMailSender', () => ({
  sendResetPasswordMail: jest.fn(),
}));
jest.mock('next/cache', () => ({ revalidatePath: jest.fn() }));

type Actions = typeof import('@/actions');
type ResolvingMock = jest.Mock<(...args: unknown[]) => Promise<unknown>>;

let actions: Actions;
let signupUser: ResolvingMock;
let getUser: ResolvingMock;
let getUserByEmailAndPassword: ResolvingMock;
let upsertPasswordResetData: ResolvingMock;
let updatePasswordByResetToken: ResolvingMock;
let insertSettings: ResolvingMock;
let upsertUser: ResolvingMock;
let sendResetPasswordMail: ResolvingMock;

const validSignup: SignupData = {
  name: 'New User',
  email: 'new@example.com',
  password: 'a-good-password',
  confirmPassword: 'a-good-password',
};

beforeAll(async () => {
  actions = await import('@/actions');
  const userRepo = await import('@/repository/userRepository');
  const settingsRepo = await import('@/repository/settingsRepository');
  const mail = await import('@/services/forgotPasswordMailSender');
  signupUser = userRepo.signupUser as unknown as ResolvingMock;
  getUser = userRepo.getUser as unknown as ResolvingMock;
  getUserByEmailAndPassword =
    userRepo.getUserByEmailAndPassword as unknown as ResolvingMock;
  upsertPasswordResetData =
    userRepo.upsertPasswordResetData as unknown as ResolvingMock;
  updatePasswordByResetToken =
    userRepo.updatePasswordByResetToken as unknown as ResolvingMock;
  upsertUser = userRepo.upsertUser as unknown as ResolvingMock;
  insertSettings = settingsRepo.insertSettings as unknown as ResolvingMock;
  sendResetPasswordMail =
    mail.sendResetPasswordMail as unknown as ResolvingMock;
});

beforeEach(() => {
  jest.clearAllMocks();
});

describe('onAfterSignup validation', () => {
  // @scenario auth/Valid sign-up
  it('creates the user for valid, matching sign-up data', async () => {
    signupUser.mockResolvedValue({ id: 1 });

    await expect(actions.onAfterSignup(validSignup)).resolves.toEqual({
      status: 'success',
    });
    expect(signupUser).toHaveBeenCalledWith({
      name: validSignup.name,
      email: validSignup.email,
      password: validSignup.password,
    });
  });

  // @scenario auth/Invalid input
  it('rejects a malformed email with a field-level error and no user', async () => {
    const result = await actions.onAfterSignup({
      ...validSignup,
      email: 'not-an-email',
    });

    expect(result.status).toBe('error');
    expect(result.errors).toHaveProperty('email');
    expect(signupUser).not.toHaveBeenCalled();
  });

  // @scenario auth/Invalid input
  it('rejects an empty name with a field-level error and no user', async () => {
    const result = await actions.onAfterSignup({ ...validSignup, name: '' });

    expect(result.status).toBe('error');
    expect(result.errors).toHaveProperty('name');
    expect(signupUser).not.toHaveBeenCalled();
  });

  // @scenario auth/Invalid input
  it('rejects a password shorter than 8 characters', async () => {
    const result = await actions.onAfterSignup({
      ...validSignup,
      password: 'short',
      confirmPassword: 'short',
    });

    expect(result.status).toBe('error');
    expect(signupUser).not.toHaveBeenCalled();
  });

  // @scenario auth/Invalid input
  it('rejects a password longer than 20 characters', async () => {
    const tooLong = 'x'.repeat(21);
    const result = await actions.onAfterSignup({
      ...validSignup,
      password: tooLong,
      confirmPassword: tooLong,
    });

    expect(result.status).toBe('error');
    expect(signupUser).not.toHaveBeenCalled();
  });

  // @scenario auth/Invalid input
  it('rejects a confirmation that does not match', async () => {
    const result = await actions.onAfterSignup({
      ...validSignup,
      confirmPassword: 'something-else',
    });

    expect(result.status).toBe('error');
    expect(signupUser).not.toHaveBeenCalled();
  });

  // @scenario auth/Duplicate email
  it('fails when the repository reports the email is taken', async () => {
    signupUser.mockRejectedValue(new Error('User already exists.'));

    await expect(actions.onAfterSignup(validSignup)).rejects.toThrow(
      'User already exists.',
    );
  });
});

describe('onCredentialsSignin', () => {
  // @scenario auth/Wrong password or unknown email
  it('returns no user when the credential check rejects', async () => {
    getUserByEmailAndPassword.mockRejectedValue(new Error('Invalid password'));

    await expect(
      actions.onCredentialsSignin('auth@example.com', 'wrong'),
    ).resolves.toBeNull();
  });

  // @scenario auth/Correct credentials
  it('returns the user when the credentials check succeeds', async () => {
    getUserByEmailAndPassword.mockResolvedValue({
      id: 42,
      email: 'auth@example.com',
      name: 'Auth Tester',
    });

    await expect(
      actions.onCredentialsSignin('auth@example.com', 'correct'),
    ).resolves.toEqual({
      id: 42,
      email: 'auth@example.com',
      name: 'Auth Tester',
    });
  });
});

describe('onForgotPassword', () => {
  // @scenario auth/Known email
  it('stores a reset token and sends the mail for a registered email', async () => {
    getUser.mockResolvedValue({ id: 42, email: 'auth@example.com' });
    upsertPasswordResetData.mockResolvedValue(undefined);
    sendResetPasswordMail.mockResolvedValue(undefined);

    await expect(
      actions.onForgotPassword({ email: 'auth@example.com' }),
    ).resolves.toEqual({ status: 'success' });

    expect(upsertPasswordResetData).toHaveBeenCalledTimes(1);
    const [userId, token] = upsertPasswordResetData.mock.calls[0];
    expect(userId).toBe(42);
    expect(sendResetPasswordMail).toHaveBeenCalledWith(
      'auth@example.com',
      token,
    );
  });

  // @scenario auth/Unknown email
  it('answers identically and sends nothing for an unknown email', async () => {
    getUser.mockResolvedValue(null);

    // The response must not reveal whether the address is registered.
    await expect(
      actions.onForgotPassword({ email: 'nobody@example.com' }),
    ).resolves.toEqual({ status: 'success' });
    expect(upsertPasswordResetData).not.toHaveBeenCalled();
    expect(sendResetPasswordMail).not.toHaveBeenCalled();
  });
});

describe('onResetPassword', () => {
  // @scenario auth/Valid token
  it('updates the password for a valid token and matching new password', async () => {
    updatePasswordByResetToken.mockResolvedValue(undefined);

    await expect(
      actions.onResetPassword({
        token: 'raw-token',
        password: 'a-good-password',
        confirmPassword: 'a-good-password',
      }),
    ).resolves.toEqual({ status: 'success' });
    expect(updatePasswordByResetToken).toHaveBeenCalledWith(
      'raw-token',
      'a-good-password',
    );
  });

  // @scenario auth/Expired or unknown token
  it('fails and changes nothing when the token is rejected', async () => {
    updatePasswordByResetToken.mockRejectedValue(new Error('Invalid token'));

    await expect(
      actions.onResetPassword({
        token: 'stale-token',
        password: 'a-good-password',
        confirmPassword: 'a-good-password',
      }),
    ).rejects.toThrow('Invalid token');
  });
});

describe('onAfterSignin for a returning user', () => {
  // @scenario auth/Returning user
  it('upserts the user without overwriting existing settings', async () => {
    upsertUser.mockResolvedValue({ id: 42, email: 'auth@example.com' });
    insertSettings.mockResolvedValue({ id: 5 });

    await actions.onAfterSignin({
      email: 'auth@example.com',
      name: 'Auth Tester',
    } as Parameters<Actions['onAfterSignin']>[0]);

    expect(upsertUser).toHaveBeenCalledWith('auth@example.com', 'Auth Tester');
    // insertSettings seeds on create only; a returning user's row is left as
    // it is (the repository's upsert uses an empty update branch).
    expect(insertSettings).toHaveBeenCalledTimes(1);
  });
});
