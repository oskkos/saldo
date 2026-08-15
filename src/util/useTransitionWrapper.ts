import { useRouter } from 'next/navigation';
import { useRef, useState, useTransition } from 'react';

/**
 * Runs a mutation, then refreshes the route, and refuses to run a second one
 * while the first is still in flight.
 *
 * The guard is a ref rather than the `busy` state because two activations can
 * land in the same frame: both would read the pre-render value of a state
 * variable, and a `disabled` attribute only takes effect once React has
 * committed. The ref is written synchronously in the same tick as the first
 * activation, so the second sees it. `busy` exists for the visual affordance.
 *
 * `run` resolves to whether the action actually ran. A dropped activation must
 * stay silent — resolving it like a success would have callers announce a write
 * that never happened.
 *
 * Note that the awaited action sits *outside* `startTransition`: the transition
 * covers the re-render, so `isPending` is false for the whole server round-trip
 * and could never have gated this.
 */
export function useTransitionWrapper() {
  const [, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const router = useRouter();

  const startTransitionWrapper = async <T>(
    action: () => Promise<T>,
    callback?: (val: T) => void,
  ): Promise<boolean> => {
    if (busyRef.current) {
      return false;
    }
    busyRef.current = true;
    setBusy(true);
    try {
      const ret = await action();
      startTransition(() => {
        callback?.(ret);
        router.refresh(); // https://github.com/vercel/next.js/issues/52350
      });
      return true;
    } finally {
      // Released even when the action threw, so a failure does not leave the
      // control that triggered it permanently inert.
      busyRef.current = false;
      setBusy(false);
    }
  };
  return [busy, startTransitionWrapper] as const;
}
