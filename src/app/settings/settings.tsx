'use client';

import { onSettingsUpdate } from '@/actions';
import DateInput from '@/components/form/dateInput';
import IntegerInput from '@/components/form/integerInput';
import { assertExists } from '@/util/assertionFunctions';
import { startOfDay } from '@/util/date';
import { toISODay } from '@/util/dateFormatter';
import { useTransitionWrapper } from '@/util/useTransitionWrapper';
import { Settings } from '@prisma/client';
import { useState } from 'react';

export default function Settings({ settings }: { settings: Settings }) {
  const [, startTransitionWrapper] = useTransitionWrapper();
  const [data, setData] = useState(settings);

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
                initial_balance_hours: val ?? 0,
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
                initial_balance_mins: val ?? 0,
              });
            }}
          />
        </div>
        <div>Begin date</div>
        <div>
          <DateInput
            value={toISODay(data.begin_date)}
            className="w-full"
            onChange={(value) => {
              assertExists(value);
              setData({
                ...data,
                begin_date: startOfDay(value),
              });
            }}
          />
        </div>
        <div className="col-span-2">
          <button
            className="btn btn-secondary mt-3 w-full"
            onClick={() => {
              const action = () =>
                onSettingsUpdate(data.user_id, {
                  initialBalanceHours: data.initial_balance_hours,
                  initialBalanceMins: data.initial_balance_mins,
                  beginDate: data.begin_date,
                });
              startTransitionWrapper(action).catch(() => {
                throw new Error('Failed to update settings');
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
