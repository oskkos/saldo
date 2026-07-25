import {
  describe,
  it,
  expect,
  jest,
  beforeAll,
  beforeEach,
} from '@jest/globals';

// The home page's reads are mocked at the repository boundary so their
// dispatch order can be observed. Presentation components are stubbed: the
// point here is when the reads are issued, not what is rendered.
jest.mock('@/repository/settingsRepository', () => ({
  getSettings: jest.fn(),
}));
jest.mock('@/repository/worklogRepository', () => ({ getWorklogs: jest.fn() }));
jest.mock('@/repository/expectedHoursOverrideRepository', () => ({
  getExpectedHoursOverrides: jest.fn(),
}));
jest.mock('@/repository/clockRepository', () => ({
  getActiveSession: jest.fn(),
}));
jest.mock('@/components/miniCalendar', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('@/components/clock/clockCard', () => ({
  __esModule: true,
  default: () => null,
}));
// The root layout is imported for its maxDuration; its auth import would
// otherwise pull in next-auth's ESM-only openid-client.
jest.mock('@/auth/authSession', () => ({
  getSession: jest.fn(),
  getUserFromSession: jest.fn(),
}));
jest.mock('@/auth/authProvider', () => ({
  AuthProvider: () => null,
}));
jest.mock('@/components/navbar', () => ({
  __esModule: true,
  default: () => null,
}));

type ResolvingMock = jest.Mock<(...args: unknown[]) => Promise<unknown>>;

let Home: typeof import('../page').default;
let reads: ResolvingMock[];

/** A promise plus the lever that settles it. */
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

beforeAll(async () => {
  Home = (await import('../page')).default;
  const settingsRepo = await import('@/repository/settingsRepository');
  const worklogRepo = await import('@/repository/worklogRepository');
  const overrideRepo =
    await import('@/repository/expectedHoursOverrideRepository');
  const clockRepo = await import('@/repository/clockRepository');
  reads = [
    worklogRepo.getWorklogs as unknown as ResolvingMock,
    settingsRepo.getSettings as unknown as ResolvingMock,
    overrideRepo.getExpectedHoursOverrides as unknown as ResolvingMock,
    clockRepo.getActiveSession as unknown as ResolvingMock,
  ];
});

beforeEach(() => {
  jest.clearAllMocks();
});

describe('home page data loading', () => {
  // @scenario data-load-performance/Home page reads run in parallel
  it('dispatches every independent read before any of them resolves', async () => {
    const gates = reads.map(() => deferred<unknown>());
    reads.forEach((read, i) => read.mockReturnValue(gates[i].promise));

    // Start the render but hold every read open.
    const rendering = Home({ searchParams: Promise.resolve({}) });
    await Promise.resolve();
    await Promise.resolve();

    // If the reads were awaited one after another, only the first would have
    // been called while the others were still blocked.
    for (const read of reads) {
      expect(read).toHaveBeenCalledTimes(1);
    }

    gates[0].resolve([]);
    gates[1].resolve({
      beginDate: new Date('2026-06-01T00:00:00.000Z'),
      expectedMinutesPerDay: 450,
    });
    gates[2].resolve([]);
    gates[3].resolve(null);
    await rendering;
  });
});

describe('route duration', () => {
  // @scenario data-load-performance/Cold start on initial load
  it('allows the request enough time to survive a database cold start', async () => {
    const { maxDuration } = await import('@/app/layout');

    // The platform default is 10s, which a Neon cold start can exceed; the
    // route raises it so the request completes instead of being killed.
    expect(maxDuration).toBeGreaterThan(10);
  });
});
