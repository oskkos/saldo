import {
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';

import type { Date_Time } from '@/util/dateFormatter';
import type { Settings } from '@/types';

// The root layout runs on every route, and its one decision governs whether every
// page in the app issues three database reads or none. Getting it wrong is not a
// rendering bug: reading for a signed-out visitor would query for a user who is not
// there on every request, and skipping the reads for a signed-in one would leave the
// navbar with no saldo and no clock.
//
// It is not rendered here. The layout returns <html>/<body>, which cannot be mounted
// inside jsdom's existing document, so the element tree is inspected directly and the
// reads are asserted at the repository boundary.
jest.mock('@/auth/authSession', () => ({ getSession: jest.fn() }));
jest.mock('@/repository/settingsRepository', () => ({
  getSettings: jest.fn(),
}));
jest.mock('@/repository/worklogRepository', () => ({ getWorklogs: jest.fn() }));
jest.mock('@/repository/clockRepository', () => ({
  getActiveSession: jest.fn(),
}));
jest.mock('@/auth/authProvider', () => ({
  AuthProvider: () => null,
}));
jest.mock('@/components/navbar', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('next/font/google', () => ({
  Inter: () => ({ className: 'inter' }),
}));

type ResolvingMock = jest.Mock<(...args: unknown[]) => Promise<unknown>>;

let RootLayout: (props: {
  children: React.ReactNode;
}) => Promise<React.ReactElement>;
let maxDuration: number;
let getSession: ResolvingMock;
let getSettings: ResolvingMock;
let getWorklogs: ResolvingMock;
let getActiveSession: ResolvingMock;

beforeAll(async () => {
  const mod = await import('../layout');
  RootLayout = mod.default;
  maxDuration = mod.maxDuration;
  getSession = (await import('@/auth/authSession'))
    .getSession as unknown as ResolvingMock;
  getSettings = (await import('@/repository/settingsRepository'))
    .getSettings as unknown as ResolvingMock;
  getWorklogs = (await import('@/repository/worklogRepository'))
    .getWorklogs as unknown as ResolvingMock;
  getActiveSession = (await import('@/repository/clockRepository'))
    .getActiveSession as unknown as ResolvingMock;
});

const time = (s: string) => s as Date_Time;

const settings: Settings = {
  id: 1,
  beginDate: new Date('2026-01-01T00:00:00Z'),
  initialBalanceHours: 0,
  initialBalanceMins: 0,
  fromDefault: time('08:00'),
  toDefault: time('16:00'),
  expectedMinutesPerDay: 450,
};

/** The props the layout hands its navbar, dug out of the returned element tree. */
type NavbarProps = {
  settings: Settings | null;
  session: unknown;
  worklogs: unknown[];
  activeSession: unknown;
};

type Node = { props?: Record<string, unknown> } | null | undefined;

/**
 * The props the layout hands its navbar.
 *
 * Found by walking the element tree for the node carrying navbar props rather than
 * by a fixed depth, so inserting or removing a wrapper does not silently make this
 * read the wrong element's props.
 */
const navbarProps = async (): Promise<NavbarProps> => {
  const isNavbar = (node: Node): node is { props: NavbarProps } =>
    !!node && typeof node === 'object' && 'worklogs' in (node.props ?? {});

  const find = (node: Node): NavbarProps | null => {
    if (isNavbar(node)) {
      return node.props;
    }
    const children = node?.props?.children as unknown;
    for (const child of Array.isArray(children) ? children : [children]) {
      const found = find(child as Node);
      if (found) {
        return found;
      }
    }
    return null;
  };

  const props = find((await RootLayout({ children: null })) as unknown as Node);
  if (!props) {
    throw new Error('layout rendered no navbar');
  }
  return props;
};

beforeEach(() => {
  getSession.mockReset();
  getSettings.mockReset();
  getWorklogs.mockReset();
  getActiveSession.mockReset();
  getSettings.mockResolvedValue(settings);
  getWorklogs.mockResolvedValue([]);
  getActiveSession.mockResolvedValue(null);
});

describe('RootLayout', () => {
  it('reads the navbar data for a signed-in visitor', async () => {
    getSession.mockResolvedValue({ user: { id: 1 } });

    const props = await navbarProps();

    expect(getSettings).toHaveBeenCalled();
    expect(getWorklogs).toHaveBeenCalled();
    expect(getActiveSession).toHaveBeenCalled();
    expect(props.settings).toEqual(settings);
  });

  it('reads nothing for a signed-out visitor', async () => {
    getSession.mockResolvedValue(null);

    const props = await navbarProps();

    // Three queries per request for a user who is not there, on every route.
    expect(getSettings).not.toHaveBeenCalled();
    expect(getWorklogs).not.toHaveBeenCalled();
    expect(getActiveSession).not.toHaveBeenCalled();
    // The navbar still renders, and knows to show nothing.
    expect(props.settings).toBeNull();
    expect(props.worklogs).toEqual([]);
    expect(props.activeSession).toBeNull();
  });

  it('gives every nested route headroom for a cold database start', () => {
    // A route-segment declaration read by the platform: if this were dropped, a
    // first request that woke a sleeping database would be killed at the default.
    expect(maxDuration).toBe(30);
  });
});
