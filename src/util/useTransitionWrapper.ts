import { useRouter } from 'next/navigation';
import { useTransition } from 'react';

export function useTransitionWrapper() {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const startTransitionWrapper = async <T>(
    action: () => Promise<T>,
    callback?: (val: T) => void,
  ) => {
    const ret = await action();
    startTransition(() => {
      callback?.(ret);
      router.refresh(); // https://github.com/vercel/next.js/issues/52350
    });
  };
  return [isPending, startTransitionWrapper] as const;
}
