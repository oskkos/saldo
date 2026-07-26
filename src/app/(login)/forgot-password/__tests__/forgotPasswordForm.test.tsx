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
// hence the dynamic import in beforeAll — the same shape as the sign-up form's test.
jest.mock('@/actions', () => ({ onForgotPassword: jest.fn() }));

type ForgotResult = { status: string; errors?: { [k: string]: string } };
type ForgotMock = jest.Mock<(data: unknown) => Promise<ForgotResult>>;

let ForgotPasswordForm: typeof import('../forgotPasswordForm').ForgotPasswordForm;
let forgot: ForgotMock;

beforeAll(async () => {
  ForgotPasswordForm = (await import('../forgotPasswordForm'))
    .ForgotPasswordForm;
  forgot = (await import('@/actions'))
    .onForgotPassword as unknown as ForgotMock;
});

const onSuccess = jest.fn<(msg: ReactNode, description?: ReactNode) => void>();
const onError = jest.fn<(msg: ReactNode) => void>();

beforeEach(() => {
  forgot.mockReset();
  onSuccess.mockReset();
  onError.mockReset();
  render(<ForgotPasswordForm onSuccess={onSuccess} onError={onError} />);
});

const submitWith = async (email: string) => {
  const user = userEvent.setup();
  await user.type(screen.getByPlaceholderText('Email'), email);
  await user.click(screen.getByRole('button', { name: 'Continue' }));
};

describe('ForgotPasswordForm', () => {
  it('confirms the request without claiming the address exists', async () => {
    forgot.mockResolvedValue({ status: 'success' });

    await submitWith('ada@example.com');

    await waitFor(() => expect(onSuccess).toHaveBeenCalled());
    const [title, description] = onSuccess.mock.calls[0];
    render(
      <>
        {title}
        {description}
      </>,
    );
    expect(screen.getByText('Email sent!')).toBeInTheDocument();
    // The wording has to stay non-committal: the same response is returned whether
    // or not an account matched, which is the requirement this form serves.
    expect(screen.getByText(/if the email is valid/i)).toBeInTheDocument();
  });

  it('shows a rejected field against that field', async () => {
    forgot.mockResolvedValue({
      status: 'error',
      errors: { email: 'Enter a valid email' },
    });

    await submitWith('ada@example.com');

    expect(await screen.findByText('Enter a valid email')).toBeInTheDocument();
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it('surfaces the reason when the action throws', async () => {
    forgot.mockRejectedValue(new Error('mail transport unavailable'));

    await submitWith('ada@example.com');

    await waitFor(() =>
      expect(onError).toHaveBeenCalledWith('mail transport unavailable'),
    );
  });

  it('does not reach the action when the email is malformed', async () => {
    await submitWith('not-an-email');

    await waitFor(() => expect(forgot).not.toHaveBeenCalled());
  });
});
