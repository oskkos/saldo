'use client';

import { onSettingsUpdate } from '@/actions';
import DateInput from '@/components/form/dateInput';
import IntegerInput from '@/components/form/integerInput';
import { ToastContext } from '@/components/toastContext';
import { assertExists } from '@/util/assertionFunctions';
import { startOfDay } from '@/util/date';
import { toISODay } from '@/util/dateFormatter';
import { useTransitionWrapper } from '@/util/useTransitionWrapper';
import { Settings } from '@prisma/client';
import { useContext, useState } from 'react';

export default function Settings({ settings }: { settings: Settings }) {
  const [, startTransitionWrapper] = useTransitionWrapper();
  const [data, setData] = useState<{
    begin_date: Date | null;
    initial_balance_hours: number | '';
    initial_balance_mins: number | '';
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
        <div className="col-span-2">
          <button
            className="btn btn-secondary mt-3 w-full"
            onClick={() => {
              const action = () => {
                assertExists(data.begin_date, 'Begin date is required');
                return onSettingsUpdate(settings.user_id, {
                  initialBalanceHours: data.initial_balance_hours || 0,
                  initialBalanceMins: data.initial_balance_mins || 0,
                  beginDate: data.begin_date,
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
