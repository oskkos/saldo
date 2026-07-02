'use client';

import { onSettingsUpdate } from '@/actions';
import DateInput from '@/components/form/dateInput';
import IntegerInput from '@/components/form/integerInput';
import ExpectedHoursFields from '@/components/expectedHoursFields';
import TimeInput from '@/components/form/timeInput';
import { ToastContext } from '@/components/toastContext';
import { assertExists } from '@/util/assertionFunctions';
import { startOfDay, timeIsGt } from '@/util/date';
import { Date_Time, toISODay } from '@/util/dateFormatter';
import { useTransitionWrapper } from '@/util/useTransitionWrapper';
import { useContext, useState } from 'react';
import { Settings as SettingsType } from '@/types';

export default function Settings({ settings }: { settings: SettingsType }) {
  const [, startTransitionWrapper] = useTransitionWrapper();
  const [data, setData] = useState<{
    beginDate: Date | null;
    initialBalanceHours: number | '';
    initialBalanceMins: number | '';
    fromDefault: Date_Time | null;
    toDefault: Date_Time | null;
    expectedHours: number | '';
    expectedMins: number | '';
  }>({
    beginDate: settings.beginDate,
    initialBalanceHours: settings.initialBalanceHours,
    initialBalanceMins: settings.initialBalanceMins,
    fromDefault: settings.fromDefault,
    toDefault: settings.toDefault,
    expectedHours: Math.floor(settings.expectedMinutesPerDay / 60),
    expectedMins: settings.expectedMinutesPerDay % 60,
  });
  const { setMsg } = useContext(ToastContext);

  return (
    <div className="flex flex-col flex-nowrap justify-center items-center mt-3">
      <h2 className="text-xl text-center m-3 mb-8 w-64">Settings</h2>

      <div className="grid grid-cols-[8rem_auto] gap-2 items-center w-80">
        <div>Initial balance</div>
        <div className="flex items-center">
          <IntegerInput
            label="Hours"
            value={data.initialBalanceHours}
            className="w-20"
            placeholder="hh"
            onChange={(val) => {
              setData({
                ...data,
                initialBalanceHours: val ?? '',
              });
            }}
          />
          <span className="mx-3">:</span>
          <IntegerInput
            label="Minutes"
            value={data.initialBalanceMins}
            className="w-20"
            placeholder="mm"
            onChange={(val) => {
              setData({
                ...data,
                initialBalanceMins: val ?? '',
              });
            }}
          />
        </div>
        <div>Begin date</div>
        <div>
          <DateInput
            value={data.beginDate ? toISODay(data.beginDate) : ''}
            className="w-full"
            onChange={(value) => {
              setData({
                ...data,
                beginDate: value ? startOfDay(value) : null,
              });
            }}
          />
        </div>
        <div>Default times</div>
        <div>
          <TimeInput
            placeholder="From"
            label="From"
            value={data.fromDefault ?? ''}
            className="w-full"
            indicatorClassName="w-full mt-4"
            onChange={(value) => {
              setData({
                ...data,
                fromDefault: value ?? null,
              });
            }}
          />
          <TimeInput
            placeholder="To"
            label="To"
            value={data.toDefault ?? ''}
            className="w-full"
            indicatorClassName="w-full mt-4"
            onChange={(value) => {
              setData({
                ...data,
                toDefault: value ?? null,
              });
            }}
          />
        </div>

        <div>Expected / day</div>
        <div>
          <ExpectedHoursFields
            hours={data.expectedHours}
            mins={data.expectedMins}
            onHours={(val) => setData({ ...data, expectedHours: val })}
            onMins={(val) => setData({ ...data, expectedMins: val })}
          />
          <p className="text-xs opacity-70 mt-1">
            Changing this recomputes your whole balance.
          </p>
        </div>

        <div className="col-span-2">
          <button
            className="btn btn-secondary mt-3 w-full"
            onClick={() => {
              const action = () => {
                assertExists(data.beginDate, 'Begin date is required');
                assertExists(data.fromDefault, 'From time is required');
                assertExists(data.toDefault, 'To time is required');

                if (timeIsGt(data.fromDefault, data.toDefault)) {
                  throw new Error('From time must be before to time');
                }
                return onSettingsUpdate({
                  initialBalanceHours: data.initialBalanceHours || 0,
                  initialBalanceMins: data.initialBalanceMins || 0,
                  beginDate: data.beginDate,
                  fromDefault: data.fromDefault,
                  toDefault: data.toDefault,
                  expectedMinutesPerDay:
                    (data.expectedHours || 0) * 60 + (data.expectedMins || 0),
                });
              };
              startTransitionWrapper(action)
                .then(() => {
                  setMsg({ type: 'success', message: 'Settings saved' });
                })
                .catch((e) => {
                  const errorMsg =
                    e instanceof Error ? (
                      <div className="text-sm">{e.message}</div>
                    ) : null;
                  setMsg({
                    type: 'error',
                    message: (
                      <div>
                        <div>Failed to save settings</div>
                        {errorMsg}
                      </div>
                    ),
                  });
                });
            }}
          >
            Submit
          </button>
        </div>
      </div>
    </div>
  );
}
