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

// Mock factory is not hoisted here (this file imports `jest` from @jest/globals),
// hence the dynamic import in beforeAll.
jest.mock('@/actions', () => ({ onResetPassword: jest.fn() }));

type ResetResult = { status: string; errors?: { [k: string]: string } };
type ResetMock = jest.Mock<(data: { token?: string }) => Promise<ResetResult>>;

let ResetPasswordForm: typeof import('../resetPasswordForm').ResetPasswordForm;
let reset: ResetMock;

beforeAll(async () => {
  ResetPasswordForm = (await import('../resetPasswordForm')).ResetPasswordForm;
  reset = (await import('@/actions')).onResetPassword as unknown as ResetMock;
});

const onSuccess = jest.fn<(msg: ReactNode) => void>();
const onError = jest.fn<(msg: ReactNode) => void>();

beforeEach(() => {
  reset.mockReset();
  onSuccess.mockReset();
  onError.mockReset();
  render(
    <ResetPasswordForm
      token="token-from-the-emailed-link"
      onSuccess={onSuccess}
      onError={onError}
    />,
  );
});

const submitWith = async (password: string, confirmation = password) => {
  const user = userEvent.setup();
  await user.type(screen.getByPlaceholderText('New password'), password);
  await user.type(
    screen.getByPlaceholderText('Confirm new password'),
    confirmation,
  );
  await user.click(screen.getByRole('button', { name: 'Reset password' }));
};

describe('ResetPasswordForm', () => {
  it('sends the token from the link along with the new password', async () => {
    reset.mockResolvedValue({ status: 'success' });

    await submitWith('hunter2hunter2');

    // Without the token the reset cannot be attributed to anyone, so it carrying
    // through from the URL is the part worth pinning.
    await waitFor(() =>
      expect(reset).toHaveBeenCalledWith(
        expect.objectContaining({ token: 'token-from-the-emailed-link' }),
      ),
    );
  });

  it('reports success with a way to reach the sign-in page', async () => {
    reset.mockResolvedValue({ status: 'success' });

    await submitWith('hunter2hunter2');

    await waitFor(() => expect(onSuccess).toHaveBeenCalled());
    render(<>{onSuccess.mock.calls[0][0]}</>);
    expect(
      screen.getByText('Password reset successfully!'),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Login here' })).toHaveAttribute(
      'href',
      '/signin',
    );
  });

  it('shows a rejected field against that field', async () => {
    reset.mockResolvedValue({
      status: 'error',
      errors: { password: 'Token expired' },
    });

    await submitWith('hunter2hunter2');

    expect(await screen.findByText('Token expired')).toBeInTheDocument();
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it('surfaces the reason when the action throws', async () => {
    reset.mockRejectedValue(new Error('token lookup failed'));

    await submitWith('hunter2hunter2');

    await waitFor(() =>
      expect(onError).toHaveBeenCalledWith('token lookup failed'),
    );
  });

  it('does not reach the action when the confirmation does not match', async () => {
    await submitWith('hunter2hunter2', 'something-else');

    await waitFor(() => expect(reset).not.toHaveBeenCalled());
  });
});
