'use client';

import { onSettingsUpdate } from '@/actions';
import DateInput from '@/components/form/dateInput';
import { assertExists } from '@/util/assertionFunctions';
import { startOfDay } from '@/util/date';
import { toISODay } from '@/util/dateFormatter';
import { Settings } from '@prisma/client';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

export default function Settings({ settings }: { settings: Settings }) {
  const [data, setData] = useState(settings);
  const [, setTransition] = useTransition();
  const router = useRouter();

  return (
    <div className="flex flex-col flex-nowrap justify-center items-center mt-3">
      <h2 className="text-xl text-center m-3 mb-8 w-64">Settings</h2>

      <div className="grid grid-cols-[8rem_auto] gap-2 items-center w-80">
        <div>Initial balance</div>
        <div className="flex items-center">
          <div className="indicator">
            <span className="indicator-item indicator-top indicator-center badge">
              Hours
            </span>

            <input
              type="number"
              className="input input-bordered w-20"
              placeholder="hh"
              value={data.initial_balance_hours}
              onChange={(e) => {
                setData({
                  ...data,
                  initial_balance_hours: parseInt(e.target.value),
                });
              }}
            />
          </div>
          <span className="mx-3">:</span>
          <div className="indicator">
            <span className="indicator-item indicator-top indicator-center badge">
              Minutes
            </span>
            <input
              type="number"
              className="input input-bordered w-20"
              placeholder="mm"
              value={data.initial_balance_mins}
              onChange={(e) => {
                setData({
                  ...data,
                  initial_balance_mins: parseInt(e.target.value),
                });
              }}
            />
          </div>
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
              setTransition(() => {
                onSettingsUpdate(data.user_id, {
                  initialBalanceHours: data.initial_balance_hours,
                  initialBalanceMins: data.initial_balance_mins,
                  beginDate: data.begin_date,
                })
                  .then(() => {
                    router.refresh(); // https://github.com/vercel/next.js/issues/52350
                  })
                  .catch(() => {
                    throw new Error('Failed to add worklog');
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
