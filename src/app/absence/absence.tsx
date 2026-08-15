'use client';
import { onAbsenceSubmit } from '@/actions';
import DateInput from '@/components/form/dateInput';
import { errorToastMessage } from '@/components/errorToast';
import { ToastContext } from '@/components/toastContext';
import { absenceReasonToString } from '@/services';
import { AbsenceData, AbsenceReason } from '@/types';
import { assertIsAbsenceReason } from '@/util/assertionFunctions';
import { startOfDay } from '@/util/date';
import { Date_ISODay, toISODay } from '@/util/dateFormatter';
import { useTransitionWrapper } from '@/util/useTransitionWrapper';
import { useContext, useState } from 'react';

export default function Absence() {
  const [busy, startTransitionWrapper] = useTransitionWrapper();
  const { setMsg } = useContext(ToastContext);
  // Only the chosen days matter here: the times each record is stored with come
  // from the user's settings, on the server. Both ends are held at the start of
  // their day so the range comparisons below cannot be skewed by a time.
  const [data, setData] = useState<AbsenceData>({
    from: startOfDay(),
    to: startOfDay(),
    comment: '',
  });

  const onFromChange = (value?: Date_ISODay) => {
    const newFrom = value ? startOfDay(value) : null;
    const newTo = newFrom && data.to && newFrom > data.to ? newFrom : data.to;
    setData({
      ...data,
      from: newFrom,
      to: newTo,
    });
  };

  const onToChange = (value?: Date_ISODay) => {
    const newTo = value ? startOfDay(value) : null;
    const newFrom = newTo && data.from && newTo < data.from ? newTo : data.from;
    setData({
      ...data,
      from: newFrom,
      to: newTo,
    });
  };

  return (
    <div className="flex flex-wrap justify-center items-start mt-3">
      <div className="flex justify-between items-center w-full max-w-xs">
        <h2 className="text-xl text-center m-3 mb-8 w-full">Absence</h2>
      </div>
      <div className="flex flex-wrap justify-between items-center m-3 w-full max-w-sm">
        <DateInput
          label="From"
          value={data.from ? toISODay(data.from) : ''}
          className="w-40"
          onChange={onFromChange}
        />
        -
        <DateInput
          label="To"
          value={data.to ? toISODay(data.to) : ''}
          className="w-40"
          onChange={onToChange}
        />
        <div className="indicator w-full mt-5">
          <span className="indicator-item indicator-top indicator-center badge">
            Reason
          </span>
          <select
            className="select select-bordered w-full"
            value={data.reason ?? ''}
            onChange={(e) => {
              assertIsAbsenceReason(e.target.value);
              setData({
                ...data,
                reason: e.target.value,
              });
            }}
          >
            <option value="" disabled>
              Pick one
            </option>
            {Object.keys(AbsenceReason).map((reason) => {
              assertIsAbsenceReason(reason);
              return (
                <option key={reason} value={reason}>
                  {absenceReasonToString(reason)}
                </option>
              );
            })}
          </select>
        </div>
        <textarea
          className="textarea textarea-bordered mt-3 w-full"
          placeholder="Comment"
          value={data.comment}
          onChange={(e) => setData({ ...data, comment: e.target.value })}
        ></textarea>
        <button
          className="btn btn-secondary mt-3 w-full"
          disabled={busy}
          onClick={() => {
            startTransitionWrapper(async () => {
              const result = await onAbsenceSubmit(data);
              if (result.status === 'error') {
                // A refusal the server wrote for this user, so it is shown as
                // it stands — unlike a thrown failure, whose message is not
                // ours and may carry nothing worth reading.
                setMsg({
                  type: 'error',
                  message: (
                    <div>
                      <div>Failed to add absence</div>
                      <div className="text-sm">{result.message}</div>
                    </div>
                  ),
                });
                return;
              }
              setMsg({ type: 'success', message: 'Absence added' });
            }).catch((e) => {
              setMsg({
                type: 'error',
                message: errorToastMessage('Failed to add absence', e),
              });
            });
          }}
        >
          Submit
        </button>
      </div>
    </div>
  );
}
