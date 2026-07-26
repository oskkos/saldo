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

// The page owns the two callbacks the form calls back into, and turning those into
// a visible success or error message is all it does. Driving the real form through
// the mocked action is what exercises that wiring, rather than calling the callbacks
// directly and asserting nothing about how they are hooked up.
jest.mock('@/actions', () => ({ onAfterSignup: jest.fn() }));

type SignupMock = jest.Mock<(data: unknown) => Promise<{ status: string }>>;

let Signup: typeof import('../page').default;
let signup: SignupMock;

beforeAll(async () => {
  Signup = (await import('../page')).default;
  signup = (await import('@/actions')).onAfterSignup as unknown as SignupMock;
});

beforeEach(() => {
  signup.mockReset();
  render(<Signup />);
});

const submitValidly = async () => {
  const user = userEvent.setup();
  await user.type(screen.getByPlaceholderText('Name'), 'Ada');
  await user.type(screen.getByPlaceholderText('Email'), 'ada@example.com');
  await user.type(screen.getByPlaceholderText('Password'), 'hunter2hunter2');
  await user.type(
    screen.getByPlaceholderText('Confirm password'),
    'hunter2hunter2',
  );
  await user.click(screen.getByRole('button', { name: 'Create an account' }));
};

describe('Signup page', () => {
  it('offers a way back to sign-in before anything is submitted', () => {
    expect(screen.getByRole('link', { name: /sign ?in/i })).toBeInTheDocument();
  });

  it('shows the success message the form reports', async () => {
    signup.mockResolvedValue({ status: 'success' });

    await submitValidly();

    expect(
      await screen.findByText('User added succesfully!'),
    ).toBeInTheDocument();
  });

  it('shows the failure the form reports', async () => {
    signup.mockRejectedValue(new Error('email service unavailable'));

    await submitValidly();

    expect(
      await screen.findByText('email service unavailable'),
    ).toBeInTheDocument();
  });
});
