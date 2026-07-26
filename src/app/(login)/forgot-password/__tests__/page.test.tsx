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

// Same shape as the sign-up page test: the real form driven through a mocked action,
// so the page's success and error callbacks are exercised as they are actually wired.
// This one also carries a description alongside the title, which is the branch in
// Message that the other pages never reach.
jest.mock('@/actions', () => ({ onForgotPassword: jest.fn() }));

type ForgotMock = jest.Mock<(data: unknown) => Promise<{ status: string }>>;

let ForgotPassword: typeof import('../page').default;
let forgot: ForgotMock;

beforeAll(async () => {
  ForgotPassword = (await import('../page')).default;
  forgot = (await import('@/actions'))
    .onForgotPassword as unknown as ForgotMock;
});

beforeEach(() => {
  forgot.mockReset();
  render(<ForgotPassword />);
});

const submitValidly = async () => {
  const user = userEvent.setup();
  await user.type(screen.getByPlaceholderText('Email'), 'ada@example.com');
  await user.click(screen.getByRole('button', { name: 'Continue' }));
};

describe('ForgotPassword page', () => {
  it('offers a way to sign up instead', () => {
    expect(screen.getByRole('link', { name: /sign ?up/i })).toBeInTheDocument();
  });

  it('shows the confirmation with its explanatory detail', async () => {
    forgot.mockResolvedValue({ status: 'success' });

    await submitValidly();

    expect(await screen.findByText('Email sent!')).toBeInTheDocument();
    expect(screen.getByText(/if the email is valid/i)).toBeInTheDocument();
  });

  it('shows the failure the form reports', async () => {
    forgot.mockRejectedValue(new Error('mail transport unavailable'));

    await submitValidly();

    expect(
      await screen.findByText('mail transport unavailable'),
    ).toBeInTheDocument();
  });
});
