'use client';

import { useContext, useState } from 'react';
import WorklogInputs from '../worklogInputs';
import { onClockDiscard, onClockOut } from '@/actions';
import { toDate } from '@/util/date';
import { WorklogFormDataEntry } from '@/types';
import { toDayMonthYear, toISODay, toTime } from '@/util/dateFormatter';
import { assertIsISODay, assertIsTime } from '@/util/assertionFunctions';
import { useTransitionWrapper } from '@/util/useTransitionWrapper';
import { ToastContext } from '../toastContext';
import { NEW_WORKLOG_DEFAULT_SUBTRACT_LUNCH } from '@/constants';
import { crossesMidnight } from './util';

export default function ClockOutModal({
  modalId,
  startedAt,
  endedAt,
  onDone,
}: {
  modalId: string;
  startedAt: Date;
  endedAt: Date;
  onDone: () => void;
}) {
  const [, startTransitionWrapper] = useTransitionWrapper();
  const { setMsg } = useContext(ToastContext);

  // The worklog day is fixed to the clock-in day (WorklogInputs edits only the
  // times), so a session that crossed midnight surfaces as an end time on the
  // start day that the user must correct (or discard).
  const startDay = toISODay(startedAt);
  const crossMidnight = crossesMidnight(startedAt, endedAt);

  const [value, setValue] = useState<WorklogFormDataEntry>({
    day: startDay,
    from: toTime(startedAt),
    to: toTime(endedAt),
    comment: '',
    subtractLunchBreak: NEW_WORKLOG_DEFAULT_SUBTRACT_LUNCH,
  });

  const save = () => {
    const action = () => {
      assertIsISODay(value.day, 'Invalid day');
      assertIsTime(value.from, 'Invalid from time');
      assertIsTime(value.to, 'Invalid to time');
      return onClockOut({
        from: toDate(value.day, value.from),
        to: toDate(value.day, value.to),
        comment: value.comment,
        subtractLunchBreak: value.subtractLunchBreak,
      });
    };
    startTransitionWrapper(action, onDone)
      .then(() => setMsg({ type: 'success', message: 'Worklog created' }))
      .catch((e) => {
        const errorMsg =
          e instanceof Error ? (
            <div className="text-sm">{e.message}</div>
          ) : null;
        setMsg({
          type: 'error',
          message: (
            <div>
              <div>Failed to save session</div>
              {errorMsg}
            </div>
          ),
        });
      });
  };

  const discard = () => {
    if (!window.confirm('Discard this session? It will not be logged.')) {
      return;
    }
    startTransitionWrapper(() => onClockDiscard(), onDone)
      .then(() => setMsg({ type: 'success', message: 'Session discarded' }))
      .catch(() =>
        setMsg({ type: 'error', message: 'Failed to discard session' }),
      );
  };

  return (
    <dialog id={modalId} className="modal modal-bottom sm:modal-middle">
      <div className="modal-box text-base-content">
        <h3 className="font-bold text-lg">Finish work session</h3>
        {crossMidnight ? (
          <div className="alert alert-warning text-sm mt-3">
            This session crossed midnight. Set an end time on{' '}
            {toDayMonthYear(startedAt)}, or discard it.
          </div>
        ) : null}
        <div className="flex flex-wrap justify-between items-center mt-3">
          <WorklogInputs value={value} setValue={setValue} />
        </div>
        <div className="modal-action">
          <form method="dialog">
            <button className="btn">Cancel</button>
          </form>
          <button className="btn btn-error btn-outline" onClick={discard}>
            Discard
          </button>
          <button className="btn btn-primary" onClick={save}>
            Save
          </button>
        </div>
      </div>
    </dialog>
  );
}
