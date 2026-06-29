'use client';

import { useContext, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { MdPlayArrow, MdStop } from 'react-icons/md';
import { onClockIn } from '@/actions';
import { ActiveSession } from '@/types';
import { now } from '@/util/date';
import { toTime } from '@/util/dateFormatter';
import { useTransitionWrapper } from '@/util/useTransitionWrapper';
import { ToastContext } from '../toastContext';
import { showModal } from '../modal';
import Elapsed from './elapsed';
import ClockOutModal from './clockOutModal';

const CLOCK_OUT_MODAL_ID = 'clock-out-modal';

export default function ClockCard({
  activeSession,
}: {
  activeSession: ActiveSession | null;
}) {
  const [, startTransitionWrapper] = useTransitionWrapper();
  const { setMsg } = useContext(ToastContext);
  const router = useRouter();

  const [startedAt, setStartedAt] = useState<Date | null>(
    activeSession?.startedAt ?? null,
  );
  const [endedAt, setEndedAt] = useState<Date | null>(null);

  // Open the finalize sheet once it is in the DOM with an end time.
  useEffect(() => {
    if (endedAt) {
      showModal(CLOCK_OUT_MODAL_ID);
    }
  }, [endedAt]);

  const clockIn = () => {
    const start = now();
    startTransitionWrapper(
      () => onClockIn(start),
      (session) => setStartedAt(session.startedAt),
    )
      .then(() => setMsg({ type: 'success', message: 'Clocked in' }))
      .catch(() => setMsg({ type: 'error', message: 'Failed to clock in' }));
  };

  const clockOut = () => setEndedAt(now());

  const onSessionDone = () => {
    setStartedAt(null);
    setEndedAt(null);
    router.refresh();
  };

  if (!startedAt) {
    return (
      <button
        className="btn btn-secondary w-full max-w-sm gap-2 min-h-18"
        onClick={clockIn}
      >
        <MdPlayArrow className="w-5 h-5" />
        Clock in
      </button>
    );
  }

  return (
    <div className="w-full max-w-sm">
      <div className="card bg-success text-success-content shadow-md min-h-18">
        <div className="card-body flex-row items-center justify-between p-3 gap-3">
          <div className="flex flex-col items-start leading-tight">
            <span className="text-xs opacity-90">
              Since {toTime(startedAt)}
            </span>
            <span className="text-xl font-mono tabular-nums">
              <Elapsed startedAt={startedAt} />
            </span>
          </div>
          <button className="btn btn-sm btn-neutral gap-1" onClick={clockOut}>
            <MdStop className="w-5 h-5" />
            Clock out
          </button>
        </div>
      </div>
      {endedAt ? (
        <ClockOutModal
          key={endedAt.getTime()}
          modalId={CLOCK_OUT_MODAL_ID}
          startedAt={startedAt}
          endedAt={endedAt}
          onDone={onSessionDone}
        />
      ) : null}
    </div>
  );
}
