'use client';
import { onWorklogSubmit } from '@/actions';
import DateInput from '@/components/form/dateInput';
import { NEW_WORKLOG_DEFAULT_FROM, NEW_WORKLOG_DEFAULT_TO } from '@/constants';
import { absenceReasonToString } from '@/services';
import { AbsenceData, AbsenceReason, WorklogFormData } from '@/types';
import { assertExists, assertIsAbsenceReason } from '@/util/assertionFunctions';
import { add, startOfDay, toDate } from '@/util/date';
import { Date_ISODay, toISODay } from '@/util/dateFormatter';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

export default function Absence({ userId }: { userId: number }) {
  const [, setTransition] = useTransition();
  const router = useRouter();
  const [data, setData] = useState<AbsenceData>({
    from: toDate(
      `${toISODay(startOfDay(new Date()))} ${NEW_WORKLOG_DEFAULT_FROM}`,
    ),
    to: toDate(`${toISODay(startOfDay(new Date()))} ${NEW_WORKLOG_DEFAULT_TO}`),
  });

  const from = data.from ? toISODay(data.from) : undefined;
  const onFromChange = (value?: Date_ISODay) => {
    assertExists(value);
    setData({
      ...data,
      from: toDate(`${value} ${NEW_WORKLOG_DEFAULT_FROM}`),
    });
  };

  const to = data.to ? toISODay(data.to) : undefined;
  const onToChange = (value?: Date_ISODay) => {
    assertExists(value);
    setData({
      ...data,
      to: toDate(`${value} ${NEW_WORKLOG_DEFAULT_FROM}`),
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
          value={from}
          className="w-40"
          onChange={onFromChange}
        />
        -
        <DateInput
          label="To"
          value={to}
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
        <button
          className="btn btn-secondary mt-3 w-full"
          onClick={() => {
            assertExists(data.reason);
            const worklogs: WorklogFormData[] = [];
            let x = data.from;
            while (x && data.to && x <= data.to) {
              worklogs.push({
                from: new Date(`${toISODay(x)} ${NEW_WORKLOG_DEFAULT_FROM}`),
                to: new Date(`${toISODay(x)} ${NEW_WORKLOG_DEFAULT_TO}`),
                comment: '',
                subtractLunchBreak: true,
                absence: data.reason,
              });
              x = add(x, 1, 'day');
            }

            setTransition(() => {
              // TODO: Handle all in one call
              Promise.all(worklogs.map((ret) => onWorklogSubmit(userId, ret)))
                .then(() => {
                  router.refresh(); // https://github.com/vercel/next.js/issues/52350
                })
                .catch(() => {
                  throw new Error('Failed to add absences');
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
