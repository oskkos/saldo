'use client';

import { useContext, useState } from 'react';
import { ExpectedHoursOverride } from '@/types';
import {
  onExpectedHoursOverrideDelete,
  onExpectedHoursOverrideUpsert,
} from '@/actions';
import DateInput from '@/components/form/dateInput';
import ExpectedHoursFields from '@/components/expectedHoursFields';
import { Date_ISODay, toISODay, toDayMonthYear } from '@/util/dateFormatter';
import { startOfDay } from '@/util/date';
import { useTransitionWrapper } from '@/util/useTransitionWrapper';
import { ToastContext } from '@/components/toastContext';
import { errorToastMessage } from '@/components/errorToast';
import { MdDelete } from 'react-icons/md';

const formatMinutes = (m: number) => `${Math.floor(m / 60)}h ${m % 60}min`;

function sortByDate(list: ExpectedHoursOverride[]) {
  return [...list].sort((a, b) => a.date.getTime() - b.date.getTime());
}

export default function ExpectedHoursOverrides({
  overrides: initial,
}: {
  overrides: ExpectedHoursOverride[];
}) {
  const [, startTransitionWrapper] = useTransitionWrapper();
  const { setMsg } = useContext(ToastContext);
  const [overrides, setOverrides] = useState(sortByDate(initial));
  const [day, setDay] = useState<Date_ISODay | ''>('');
  const [hours, setHours] = useState<number | ''>('');
  const [mins, setMins] = useState<number | ''>('');
  const [label, setLabel] = useState('');

  const canSave = day !== '' && (hours || 0) * 60 + (mins || 0) >= 0;

  const save = () => {
    startTransitionWrapper(
      () =>
        onExpectedHoursOverrideUpsert({
          date: startOfDay(day as Date_ISODay),
          minutes: (hours || 0) * 60 + (mins || 0),
          label: label.trim() || undefined,
        }),
      (saved: ExpectedHoursOverride) => {
        setOverrides((prev) =>
          sortByDate([
            ...prev.filter((o) => toISODay(o.date) !== toISODay(saved.date)),
            saved,
          ]),
        );
        setDay('');
        setHours('');
        setMins('');
        setLabel('');
      },
    )
      .then(() => setMsg({ type: 'success', message: 'Special day saved' }))
      .catch((e) =>
        setMsg({
          type: 'error',
          message: errorToastMessage('Failed to save special day', e),
        }),
      );
  };

  const remove = (id: number) => {
    startTransitionWrapper(
      () => onExpectedHoursOverrideDelete(id),
      () => setOverrides((prev) => prev.filter((o) => o.id !== id)),
    )
      .then(() => setMsg({ type: 'success', message: 'Special day removed' }))
      .catch((e) =>
        setMsg({
          type: 'error',
          message: errorToastMessage('Failed to remove special day', e),
        }),
      );
  };

  const edit = (o: ExpectedHoursOverride) => {
    setDay(toISODay(o.date));
    setHours(Math.floor(o.minutes / 60));
    setMins(o.minutes % 60);
    setLabel(o.label ?? '');
  };

  return (
    <details className="collapse collapse-arrow border border-base-300 bg-base-100 w-80 mt-8">
      <summary className="collapse-title text-lg">Special days</summary>
      <div className="collapse-content">
        <p className="text-xs opacity-70 mb-3">
          Days that expect fewer (or more) hours than your default.
        </p>

        {overrides.length === 0 ? (
          <p className="text-sm opacity-70">No special days yet.</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {overrides.map((o) => (
              <li
                key={o.id}
                className="flex items-center justify-between gap-2 text-sm"
              >
                <button
                  type="button"
                  className="flex-1 text-left cursor-pointer hover:underline"
                  onClick={() => edit(o)}
                >
                  {toDayMonthYear(o.date)} — {formatMinutes(o.minutes)}
                  {o.label ? ` (${o.label})` : ''}
                </button>
                <MdDelete
                  title="Remove"
                  className="h-5 w-5 cursor-pointer text-error"
                  onClick={() => remove(o.id)}
                />
              </li>
            ))}
          </ul>
        )}

        <div className="mt-4 flex flex-col gap-2">
          <DateInput
            value={day}
            placeholder="Date"
            className="w-full"
            onChange={(value) => setDay(value ?? '')}
          />
          <ExpectedHoursFields
            hours={hours}
            mins={mins}
            label={label}
            onHours={setHours}
            onMins={setMins}
            onLabel={setLabel}
          />
          <button
            className="btn btn-secondary w-full"
            disabled={!canSave}
            onClick={save}
          >
            Add special day
          </button>
        </div>
      </div>
    </details>
  );
}
