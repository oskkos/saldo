import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, renderHook } from '@testing-library/react';

// The hook's whole job is refusing to run a second mutation while the first is
// in flight, so the router is stubbed and the action is a promise this test
// resolves by hand — the in-flight window has to be held open to assert on it.
const refresh = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ refresh }),
}));

let useTransitionWrapper: typeof import('../useTransitionWrapper').useTransitionWrapper;

beforeEach(async () => {
  refresh.mockReset();
  useTransitionWrapper = (await import('../useTransitionWrapper'))
    .useTransitionWrapper;
});

/** A promise plus the handles to settle it, so the action can be held open. */
const deferred = <T>() => {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

describe('useTransitionWrapper', () => {
  // @scenario mutation-safety/Second activation during an in-flight mutation is dropped
  // @scenario mutation-safety/The gate spans the server round-trip
  it('drops a second call while the first is still in flight', async () => {
    const { result } = renderHook(() => useTransitionWrapper());
    const gate = deferred<string>();
    const action = jest.fn(() => gate.promise);

    let first!: Promise<boolean>;
    let second!: Promise<boolean>;
    await act(async () => {
      first = result.current[1](action);
      // Issued while the first is still awaiting its server call — the exact
      // window the old `isPending` reported as idle.
      second = result.current[1](action);
    });

    await expect(second).resolves.toBe(false);
    expect(action).toHaveBeenCalledTimes(1);

    await act(async () => {
      gate.resolve('done');
      await first;
    });
    await expect(first).resolves.toBe(true);
  });

  // @scenario mutation-safety/Two activations before the interface re-renders
  it('runs the action once for two calls in the same tick', async () => {
    const { result } = renderHook(() => useTransitionWrapper());
    const gate = deferred<string>();
    const action = jest.fn(() => gate.promise);

    await act(async () => {
      // No await between them: nothing has re-rendered, so a state-based guard
      // would let both through.
      void result.current[1](action);
      void result.current[1](action);
      gate.resolve('done');
    });

    expect(action).toHaveBeenCalledTimes(1);
  });

  // @scenario mutation-safety/A dropped submission reports nothing
  // @scenario mutation-safety/Dropped submission leaves the view unchanged
  it('does not invoke the callback for a dropped call', async () => {
    const { result } = renderHook(() => useTransitionWrapper());
    const gate = deferred<string>();
    const callback = jest.fn();

    await act(async () => {
      void result.current[1](() => gate.promise, callback);
      void result.current[1](() => gate.promise, callback);
      gate.resolve('done');
    });

    expect(callback).toHaveBeenCalledTimes(1);
  });

  // @scenario mutation-safety/A later interaction is not blocked
  it('runs again once the first call has finished', async () => {
    const { result } = renderHook(() => useTransitionWrapper());
    const action = jest.fn(() => Promise.resolve('done'));

    await act(async () => {
      await result.current[1](action);
    });
    await act(async () => {
      await result.current[1](action);
    });

    expect(action).toHaveBeenCalledTimes(2);
  });

  // @scenario mutation-safety/The gate is released after a failure
  it('releases the guard when the action throws', async () => {
    const { result } = renderHook(() => useTransitionWrapper());
    const failing = jest.fn(() => Promise.reject(new Error('nope')));

    await act(async () => {
      await expect(result.current[1](failing)).rejects.toThrow('nope');
    });

    const succeeding = jest.fn(() => Promise.resolve('done'));
    await act(async () => {
      await expect(result.current[1](succeeding)).resolves.toBe(true);
    });
    expect(succeeding).toHaveBeenCalled();
  });

  // @scenario mutation-safety/Control is disabled during the mutation
  // @scenario mutation-safety/Control becomes available again
  it('reports busy for as long as the action is in flight', async () => {
    const { result } = renderHook(() => useTransitionWrapper());
    const gate = deferred<string>();

    expect(result.current[0]).toBe(false);

    let run!: Promise<boolean>;
    await act(async () => {
      run = result.current[1](() => gate.promise);
    });
    expect(result.current[0]).toBe(true);

    await act(async () => {
      gate.resolve('done');
      await run;
    });
    expect(result.current[0]).toBe(false);
  });

  it('refreshes the route after a successful action', async () => {
    const { result } = renderHook(() => useTransitionWrapper());

    await act(async () => {
      await result.current[1](() => Promise.resolve('done'));
    });

    expect(refresh).toHaveBeenCalled();
  });

  it('passes the action result to the callback', async () => {
    const { result } = renderHook(() => useTransitionWrapper());
    const callback = jest.fn();

    await act(async () => {
      await result.current[1](() => Promise.resolve({ id: 7 }), callback);
    });

    expect(callback).toHaveBeenCalledWith({ id: 7 });
  });
});
