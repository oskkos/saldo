import { beforeAll, describe, expect, it, jest } from '@jest/globals';
import { render, screen } from '@testing-library/react';
import type { Session } from 'next-auth';

import type { Date_Time } from '@/util/dateFormatter';
import type { Settings } from '@/types';

// Navbar is an async server component: awaited, then the element rendered.
//
// Its one decision is whether the signed-in furniture appears at all, and getting it
// wrong either strands a signed-in user without navigation or shows a signed-out
// visitor a saldo badge. Every child is stubbed — each has its own test, and several
// would otherwise drag server-only or next-auth modules into the graph.
jest.mock('../menu', () => ({
  __esModule: true,
  default: () => <nav>menu</nav>,
}));
jest.mock('../saldoBadge', () => ({
  __esModule: true,
  default: () => <span>saldo</span>,
}));
jest.mock('../clock/clockBadgeIndicator', () => ({
  __esModule: true,
  default: () => <span>clock-indicator</span>,
}));
jest.mock('../quickAdd', () => ({
  __esModule: true,
  default: () => <span>quick-add</span>,
}));
jest.mock('../themeSwitcher', () => ({
  __esModule: true,
  default: () => <span>theme-switcher</span>,
}));
jest.mock('../dock', () => ({
  __esModule: true,
  default: () => <div>dock</div>,
}));
jest.mock('@/auth/authActions', () => ({
  __esModule: true,
  default: () => <span>auth-actions</span>,
}));

let Navbar: typeof import('../navbar').default;

beforeAll(async () => {
  Navbar = (await import('../navbar')).default;
});

const time = (s: string) => s as Date_Time;

const settings: Settings = {
  id: 1,
  beginDate: new Date('2026-01-01'),
  initialBalanceHours: 0,
  initialBalanceMins: 0,
  fromDefault: time('08:00'),
  toDefault: time('16:00'),
  expectedMinutesPerDay: 450,
};

const session = { user: { id: 1 } } as unknown as Session;

const renderNavbar = async (props: {
  settings: Settings | null;
  session: Session | null;
}) => {
  const element = await Navbar({
    ...props,
    worklogs: [],
    activeSession: null,
    children: <main>page content</main>,
  });
  return render(element);
};

describe('Navbar', () => {
  it('shows the signed-in furniture when there is a session and settings', async () => {
    await renderNavbar({ settings, session });

    for (const stub of [
      'menu',
      'saldo',
      'clock-indicator',
      'quick-add',
      'auth-actions',
      'dock',
    ]) {
      expect(screen.getByText(stub)).toBeInTheDocument();
    }
    expect(screen.getByText('page content')).toBeInTheDocument();
  });

  it('withholds all of it when there is no session', async () => {
    await renderNavbar({ settings, session: null });

    for (const stub of ['menu', 'saldo', 'quick-add', 'auth-actions', 'dock']) {
      expect(screen.queryByText(stub)).not.toBeInTheDocument();
    }
    // The theme switcher and the page itself are for everyone.
    expect(screen.getByText('theme-switcher')).toBeInTheDocument();
    expect(screen.getByText('page content')).toBeInTheDocument();
  });

  it('withholds it when the user has no settings yet', async () => {
    await renderNavbar({ settings: null, session });

    expect(screen.queryByText('menu')).not.toBeInTheDocument();
    expect(screen.queryByText('dock')).not.toBeInTheDocument();
  });
});
