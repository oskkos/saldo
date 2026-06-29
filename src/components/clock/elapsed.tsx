'use client';

import { useEffect, useState } from 'react';
import { now } from '@/util/date';

function format(ms: number) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

// Live-ticking elapsed time since startedAt. now() and startedAt are both
// wall-clock-as-UTC, so their difference is the real elapsed duration.
export default function Elapsed({ startedAt }: { startedAt: Date }) {
  const [ms, setMs] = useState(0);

  useEffect(() => {
    const tick = () => setMs(now().getTime() - startedAt.getTime());
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [startedAt]);

  return <span>{format(ms)}</span>;
}
