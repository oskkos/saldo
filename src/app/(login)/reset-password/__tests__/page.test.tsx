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

// ResetPassword is an async server component: awaited, then the element rendered.
//
// This page is the guard that decides whether a token from a URL is allowed to reach
// the reset form at all, so all three answers are driven: no token, a token matching
// no stored hash, and a good one. Page2 is deliberately left real, so the accepted
// path proves the form is reachable and carries the token rather than proving a stub
// was called.
jest.mock('@/repository/userRepository', () => ({
  getUserByPasswordResetToken: jest.fn(),
}));
jest.mock('@/actions', () => ({ onResetPassword: jest.fn() }));

type LookupMock = jest.Mock<(token: string) => Promise<unknown>>;
type SearchParams = { [key: string]: string | string[] | undefined };

let ResetPassword: (props: {
  params: { slug: string };
  searchParams: Promise<SearchParams>;
}) => Promise<React.ReactElement>;
let lookup: LookupMock;

beforeAll(async () => {
  ResetPassword = (await import('../page')).default;
  lookup = (await import('@/repository/userRepository'))
    .getUserByPasswordResetToken as unknown as LookupMock;
});

beforeEach(() => {
  lookup.mockReset();
});

const renderPage = async (searchParams: SearchParams) => {
  const element = await ResetPassword({
    params: { slug: 'reset-password' },
    searchParams: Promise.resolve(searchParams),
  });
  return render(element);
};

describe('ResetPassword page', () => {
  it('refuses a link with no token', async () => {
    await renderPage({});

    expect(screen.getByRole('alert')).toHaveTextContent('Invalid token');
    expect(lookup).not.toHaveBeenCalled();
  });

  it('refuses a link whose token parameter repeats', async () => {
    await renderPage({ token: ['one', 'two'] });

    expect(screen.getByRole('alert')).toHaveTextContent('Invalid token');
    // An array cannot identify a single token, so no lookup is attempted.
    expect(lookup).not.toHaveBeenCalled();
  });

  it('refuses a token that matches no stored hash', async () => {
    lookup.mockResolvedValue(null);

    await renderPage({ token: 'expired-or-forged' });

    expect(lookup).toHaveBeenCalledWith('expired-or-forged');
    expect(screen.getByRole('alert')).toHaveTextContent('Invalid token');
  });

  it('shows the reset form for a token that resolves to a user', async () => {
    lookup.mockResolvedValue({ id: 1, email: 'ada@example.com' });

    await renderPage({ token: 'good-token' });

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByPlaceholderText('New password')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Reset password' }),
    ).toBeInTheDocument();
  });

  it('reports the outcome once the new password is submitted', async () => {
    lookup.mockResolvedValue({ id: 1, email: 'ada@example.com' });
    const reset = (await import('@/actions'))
      .onResetPassword as unknown as jest.Mock<
      (data: unknown) => Promise<{ status: string }>
    >;
    reset.mockResolvedValue({ status: 'success' });

    await renderPage({ token: 'good-token' });

    const user = userEvent.setup();
    await user.type(
      screen.getByPlaceholderText('New password'),
      'hunter2hunter2',
    );
    await user.type(
      screen.getByPlaceholderText('Confirm new password'),
      'hunter2hunter2',
    );
    await user.click(screen.getByRole('button', { name: 'Reset password' }));

    expect(
      await screen.findByText('Password reset successfully!'),
    ).toBeInTheDocument();
  });
});
