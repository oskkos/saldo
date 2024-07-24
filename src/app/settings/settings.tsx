'use client';

import { onSettingsUpdate } from '@/actions';
import DateInput from '@/components/form/dateInput';
import IntegerInput from '@/components/form/integerInput';
import TimeInput from '@/components/form/timeInput';
import { ToastContext } from '@/components/toastContext';
import { assertExists } from '@/util/assertionFunctions';
import { startOfDay, timeIsGt } from '@/util/date';
import { Date_Time, toISODay } from '@/util/dateFormatter';
import { useTransitionWrapper } from '@/util/useTransitionWrapper';
import { useContext, useState } from 'react';
import { Settings as SettingsType } from '@/repository/settingsRepository';

export default function Settings({ settings }: { settings: SettingsType }) {
  const [, startTransitionWrapper] = useTransitionWrapper();
  const [data, setData] = useState<{
    begin_date: Date | null;
    initial_balance_hours: number | '';
    initial_balance_mins: number | '';
    from_default: Date_Time | null;
    to_default: Date_Time | null;
  }>(settings);
  const { setMsg } = useContext(ToastContext);

  return (
    <div className="flex flex-col flex-nowrap justify-center items-center mt-3">
      <h2 className="text-xl text-center m-3 mb-8 w-64">Settings</h2>

      <div className="grid grid-cols-[8rem_auto] gap-2 items-center w-80">
        <div>Initial balance</div>
        <div className="flex items-center">
          <IntegerInput
            label="Hours"
            value={data.initial_balance_hours}
            className="w-20"
            placeholder="hh"
            onChange={(val) => {
              setData({
                ...data,
                initial_balance_hours: val ?? '',
              });
            }}
          />
          <span className="mx-3">:</span>
          <IntegerInput
            label="Minutes"
            value={data.initial_balance_mins}
            className="w-20"
            placeholder="mm"
            onChange={(val) => {
              setData({
                ...data,
                initial_balance_mins: val ?? '',
              });
            }}
          />
        </div>
        <div>Begin date</div>
        <div>
          <DateInput
            value={data.begin_date ? toISODay(data.begin_date) : ''}
            className="w-full"
            onChange={(value) => {
              setData({
                ...data,
                begin_date: value ? startOfDay(value) : null,
              });
            }}
          />
        </div>
        <div>Default times</div>
        <div>
          <TimeInput
            placeholder="From"
            label="From"
            value={data.from_default ?? ''}
            className="w-full"
            indicatorClassName="w-full mt-4"
            onChange={(value) => {
              setData({
                ...data,
                from_default: value ?? null,
              });
            }}
          />
          <TimeInput
            placeholder="To"
            label="To"
            value={data.to_default ?? ''}
            className="w-full"
            indicatorClassName="w-full mt-4"
            onChange={(value) => {
              setData({
                ...data,
                to_default: value ?? null,
              });
            }}
          />
        </div>

        <div className="col-span-2">
          <button
            className="btn btn-secondary mt-3 w-full"
            onClick={() => {
              const action = () => {
                assertExists(data.begin_date, 'Begin date is required');
                assertExists(data.from_default, 'From time is required');
                assertExists(data.to_default, 'To time is required');

                if (timeIsGt(data.from_default, data.to_default)) {
                  throw new Error('From time must be before to time');
                }
                return onSettingsUpdate(settings.user_id, {
                  initialBalanceHours: data.initial_balance_hours || 0,
                  initialBalanceMins: data.initial_balance_mins || 0,
                  beginDate: data.begin_date,
                  fromDefault: data.from_default,
                  toDefault: data.to_default,
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
