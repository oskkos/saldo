import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import { act, render, screen } from '@testing-library/react';

// The running clock a user watches while clocked in. now() is mocked so the elapsed
// figure is a fact rather than a race with the test's own wall clock.
jest.mock('@/util/date', () => ({ now: jest.fn() }));

type NowMock = jest.Mock<() => Date>;

let Elapsed: typeof import('../elapsed').default;
let now: NowMock;

beforeAll(async () => {
  Elapsed = (await import('../elapsed')).default;
  now = (await import('@/util/date')).now as unknown as NowMock;
});

const startedAt = new Date('2026-07-26T08:00:00Z');
const at = (isoTime: string) => new Date(`2026-07-26T${isoTime}Z`);

beforeEach(() => {
  jest.useFakeTimers();
  now.mockReset();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('Elapsed', () => {
  it('shows the time since the session started', () => {
    now.mockReturnValue(at('09:23:07'));

    render(<Elapsed startedAt={startedAt} />);

    expect(screen.getByText('1:23:07')).toBeInTheDocument();
  });

  it('pads minutes and seconds so the width does not jump', () => {
    now.mockReturnValue(at('08:05:09'));

    render(<Elapsed startedAt={startedAt} />);

    expect(screen.getByText('0:05:09')).toBeInTheDocument();
  });

  it('keeps ticking once a second', () => {
    now.mockReturnValue(at('08:00:00'));
    render(<Elapsed startedAt={startedAt} />);
    expect(screen.getByText('0:00:00')).toBeInTheDocument();

    now.mockReturnValue(at('08:00:01'));
    act(() => {
      jest.advanceTimersByTime(1000);
    });

    expect(screen.getByText('0:00:01')).toBeInTheDocument();
  });

  it('never counts backwards if the clock disagrees', () => {
    // A server-side start stamped slightly ahead of the browser must not render as
    // a negative duration.
    now.mockReturnValue(at('07:59:30'));

    render(<Elapsed startedAt={startedAt} />);

    expect(screen.getByText('0:00:00')).toBeInTheDocument();
  });

  it('stops ticking once it is gone', () => {
    now.mockReturnValue(at('08:00:00'));
    const { unmount } = render(<Elapsed startedAt={startedAt} />);

    unmount();
    now.mockReturnValue(at('08:00:05'));
    act(() => {
      jest.advanceTimersByTime(5000);
    });

    // The interval was cleared, so nothing tried to update an unmounted component.
    expect(screen.queryByText('0:00:05')).not.toBeInTheDocument();
  });
});
