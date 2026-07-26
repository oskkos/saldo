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
import type { ReactNode } from 'react';

// The form's only write path is the onAfterSignup server action, so mocking it is
// what lets each of the four outcomes be driven: accepted, rejected with field
// errors, thrown, and refused client-side before the action is reached. The mock
// factory is not hoisted (this file imports `jest` from @jest/globals), hence the
// dynamic import in beforeAll.
jest.mock('@/actions', () => ({ onAfterSignup: jest.fn() }));

type SignupResult = { status: string; errors?: { [k: string]: string } };
type SignupMock = jest.Mock<(data: unknown) => Promise<SignupResult>>;

let SignupForm: typeof import('../signupForm').SignupForm;
let signup: SignupMock;

beforeAll(async () => {
  SignupForm = (await import('../signupForm')).SignupForm;
  signup = (await import('@/actions')).onAfterSignup as unknown as SignupMock;
});

const onSuccess = jest.fn<(msg: ReactNode) => void>();
const onError = jest.fn<(msg: ReactNode) => void>();

beforeEach(() => {
  signup.mockReset();
  onSuccess.mockReset();
  onError.mockReset();
  render(<SignupForm onSuccess={onSuccess} onError={onError} />);
});

/** Fill every field with values the schema accepts. */
const fillValidly = async () => {
  const user = userEvent.setup();
  await user.type(screen.getByPlaceholderText('Name'), 'Ada');
  await user.type(screen.getByPlaceholderText('Email'), 'ada@example.com');
  await user.type(screen.getByPlaceholderText('Password'), 'hunter2hunter2');
  await user.type(
    screen.getByPlaceholderText('Confirm password'),
    'hunter2hunter2',
  );
  return user;
};

const submit = async (user: ReturnType<typeof userEvent.setup>) =>
  user.click(screen.getByRole('button', { name: 'Create an account' }));

describe('SignupForm', () => {
  it('reports success with a way to reach the sign-in page', async () => {
    signup.mockResolvedValue({ status: 'success' });
    const user = await fillValidly();

    await submit(user);

    await waitFor(() => expect(onSuccess).toHaveBeenCalled());
    // Rendering what it passed up is the only way to assert the node's content.
    render(<>{onSuccess.mock.calls[0][0]}</>);
    expect(screen.getByText('User added succesfully!')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Login here' })).toHaveAttribute(
      'href',
      '/signin',
    );
  });

  it('shows a rejected field against that field', async () => {
    signup.mockResolvedValue({
      status: 'error',
      errors: { email: 'Email already in use' },
    });
    const user = await fillValidly();

    await submit(user);

    expect(await screen.findByText('Email already in use')).toBeInTheDocument();
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it('surfaces the reason when the action throws', async () => {
    signup.mockRejectedValue(new Error('database is on fire'));
    const user = await fillValidly();

    await submit(user);

    await waitFor(() =>
      expect(onError).toHaveBeenCalledWith('database is on fire'),
    );
  });

  it('falls back to a generic message when what was thrown is not an Error', async () => {
    signup.mockRejectedValue('just a string');
    const user = await fillValidly();

    await submit(user);

    await waitFor(() =>
      expect(onError).toHaveBeenCalledWith('An error occurred.'),
    );
  });

  it('does not reach the action when the input is invalid', async () => {
    const user = userEvent.setup();
    await user.type(screen.getByPlaceholderText('Email'), 'not-an-email');

    await submit(user);

    // The schema rejects it first, so nothing is sent and the user is told why.
    await waitFor(() => expect(signup).not.toHaveBeenCalled());
    expect(onSuccess).not.toHaveBeenCalled();
  });
});
