'use client';

import { useContext, useState } from 'react';
import WorklogInputs from '../worklogInputs';
import Modal from '../modal';
import { onClockDiscard, onClockOut } from '@/actions';
import { ClockOutResult, WorklogFormDataEntry } from '@/types';
import { toDayMonthYear, toISODay, toTime } from '@/util/dateFormatter';
import { useTransitionWrapper } from '@/util/useTransitionWrapper';
import { ToastContext } from '../toastContext';
import { NEW_WORKLOG_DEFAULT_SUBTRACT_LUNCH } from '@/constants';
import { crossesMidnight } from './util';
import { toWorklogFormData } from '@/util/worklogFormData';
import { errorToastMessage, failureToastMessage } from '../errorToast';

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
  // times). A session that crossed midnight has no valid same-day end time, so
  // rather than prefill a plausible-but-wrong one we blank it and require the
  // user to enter a real end time (or discard) — Save stays disabled until then.
  const crossMidnight = crossesMidnight(startedAt, endedAt);

  const [value, setValue] = useState<WorklogFormDataEntry>({
    day: toISODay(startedAt),
    from: toTime(startedAt),
    to: crossMidnight ? '' : toTime(endedAt),
    comment: '',
    subtractLunchBreak: NEW_WORKLOG_DEFAULT_SUBTRACT_LUNCH,
  });

  const save = () => {
    startTransitionWrapper(
      () => onClockOut(toWorklogFormData(value)),
      (result: ClockOutResult) => {
        if (result.status === 'success') {
          onDone();
          // A repeat finds the session already closed and writes nothing; say
          // so rather than claiming a second worklog was created.
          setMsg({
            type: 'success',
            message: result.finalized
              ? 'Worklog created'
              : 'Session was already finished',
          });
          return;
        }
        setMsg({
          type: 'error',
          message: failureToastMessage(
            'Failed to save session',
            result.message,
          ),
        });
      },
    ).catch((e) =>
      setMsg({
        type: 'error',
        message: errorToastMessage('Failed to save session', e),
      }),
    );
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
    <Modal
      id={modalId}
      confirmLabel="Save"
      confirmAction={save}
      confirmDisabled={!value.from || !value.to}
      secondaryLabel="Discard"
      secondaryAction={discard}
      secondaryClassName="btn-error btn-outline"
    >
      <h3 className="font-bold text-lg">Finish work session</h3>
      {crossMidnight ? (
        <div className="alert alert-warning text-sm mt-3">
          This session crossed midnight. Set an end time on{' '}
          {toDayMonthYear(startedAt)}, or discard it.
        </div>
      ) : null}
      <div className="flex flex-wrap justify-between items-center mt-3">
        <WorklogInputs
          value={value}
          setValue={setValue}
          anchor={toTime(startedAt)}
          allowDuration={false}
        />
      </div>
    </Modal>
  );
}
