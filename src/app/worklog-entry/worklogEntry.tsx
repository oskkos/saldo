'use client';
import { WorklogFormData, WorklogFormDataEntry } from '@/types';
import { add, subtract, toDate } from '@/util/date';
import { Date_ISODay, toDayMonthYear, toISODay } from '@/util/dateFormatter';
import { useContext, useRef, useState } from 'react';
import ExistingWorklogs from './existingWorklogs';
import { Worklog } from '@prisma/client';
import WorklogInputs from '@/components/worklogInputs';
import { useRouter } from 'next/navigation';
import { MdArrowBack, MdArrowForward } from 'react-icons/md';
import Link from 'next/link';
import useSwipeEvents from 'beautiful-react-hooks/useSwipeEvents';
import {
  NEW_WORKLOG_DEFAULT_FROM,
  NEW_WORKLOG_DEFAULT_SUBTRACT_LUNCH,
  NEW_WORKLOG_DEFAULT_TO,
} from '@/constants';
import { sortWorklogs } from '@/services';
import { assertIsISODay, assertIsTime } from '@/util/assertionFunctions';
import { useTransitionWrapper } from '@/util/useTransitionWrapper';
import { ToastContext } from '@/components/toastContext';

export default function WorklogEntry({
  day,
  worklogs,
  onSubmit,
}: {
  day: Date_ISODay;
  worklogs: Worklog[];
  onSubmit: (value: WorklogFormData) => Promise<Worklog>;
}) {
  const [, startTransitionWrapper] = useTransitionWrapper();
  const { setMsg } = useContext(ToastContext);
  const router = useRouter();
  const [value, setValue] = useState<WorklogFormDataEntry>({
    day: day,
    from: NEW_WORKLOG_DEFAULT_FROM,
    to: NEW_WORKLOG_DEFAULT_TO,
    comment: '',
    subtractLunchBreak: NEW_WORKLOG_DEFAULT_SUBTRACT_LUNCH,
  });
  const [wl, setWl] = useState(worklogs);

  const ref = useRef<HTMLDivElement>(null);
  const { onSwipeLeft, onSwipeRight } = useSwipeEvents(ref, {
    threshold: 80,
    preventDefault: false,
  });
  onSwipeLeft(() => {
    router.push(`/worklog-entry?day=${toISODay(add(day, 1, 'day'))}`);
  });
  onSwipeRight(() => {
    router.push(`/worklog-entry?day=${toISODay(subtract(day, 1, 'day'))}`);
  });

  return (
    <>
      <div className="flex flex-wrap justify-center items-start mt-3" ref={ref}>
        <div className="flex justify-between items-center w-80">
          <div>
            <Link
              href={`/worklog-entry?day=${toISODay(subtract(day, 1, 'day'))}`}
            >
              <MdArrowBack
                className="w-6 h-6 cursor-pointer"
                title="Yesterday"
              />
            </Link>
          </div>

          <h2 className="text-xl text-center m-3 w-64">
            {toDayMonthYear(day)}
          </h2>
          <div>
            <Link href={`/worklog-entry?day=${toISODay(add(day, 1, 'day'))}`}>
              <MdArrowForward
                className="w-6 h-6 cursor-pointer"
                title="Tomorrow"
              />
            </Link>
          </div>
        </div>
        <div className="flex flex-wrap justify-between items-center m-3 w-80">
          <WorklogInputs value={value} setValue={setValue} />
          <button
            className="btn btn-secondary mt-3 w-full"
            onClick={() => {
              const action = () => {
                assertIsISODay(value.day, 'Invalid day');
                assertIsTime(value.from, 'Invalid from time');
                assertIsTime(value.to, 'Invalid to time');
                const ret = {
                  ...value,
                  from: toDate(value.day, value.from),
                  to: toDate(value.day, value.to),
                };
                return onSubmit(ret);
              };
              const callback = (x: Worklog) => {
                setWl(sortWorklogs([...wl, x]));
              };
              startTransitionWrapper(action, callback)
                .then(() => {
                  setMsg({ type: 'success', message: 'Worklog created' });
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
                        <div>Failed to create worklog</div>
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
      <div className="flex flex-wrap justify-center items-center mt-3">
        <ExistingWorklogs
          worklogs={wl}
          onDelete={(deletedWorklogId: number) => {
            setWl(sortWorklogs(wl.filter((x) => x.id !== deletedWorklogId)));
          }}
          onEdit={(edited: Worklog) => {
            setWl(
              sortWorklogs(wl.map((x) => (x.id !== edited.id ? x : edited))),
            );
          }}
        />
      </div>
    </>
  );
}
