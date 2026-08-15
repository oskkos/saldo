'use client';
import {
  ExpectedHoursOverride,
  Worklog,
  WorklogFormData,
  WorklogFormDataEntry,
  WorklogSubmitResult,
} from '@/types';
import {
  errorToastMessage,
  failureToastMessage,
} from '@/components/errorToast';
import DayExpectedOverride from './dayExpectedOverride';
import { add, subtract, toDate } from '@/util/date';
import {
  Date_ISODay,
  Date_Time,
  toDayMonthYear,
  toISODay,
} from '@/util/dateFormatter';
import { useContext, useRef, useState } from 'react';
import ExistingWorklogs from './existingWorklogs';
import WorklogInputs from '@/components/worklogInputs';
import { useRouter } from 'next/navigation';
import { MdArrowBack, MdArrowForward } from 'react-icons/md';
import Link from 'next/link';
import useSwipeEvents from 'beautiful-react-hooks/useSwipeEvents';
import { NEW_WORKLOG_DEFAULT_SUBTRACT_LUNCH } from '@/constants';
import { sortWorklogs } from '@/services';
import { assertIsISODay, assertIsTime } from '@/util/assertionFunctions';
import { useTransitionWrapper } from '@/util/useTransitionWrapper';
import { confirmOverlap } from '@/util/confirmOverlap';
import { ToastContext } from '@/components/toastContext';

export default function WorklogEntry({
  day,
  defaults,
  worklogs,
  onSubmit,
  expectedMinutes,
  override,
}: {
  day: Date_ISODay;
  defaults: { fromDefault: Date_Time; toDefault: Date_Time };
  worklogs: Worklog[];
  onSubmit: (
    value: WorklogFormData,
    options?: { allowOverlap?: boolean },
  ) => Promise<WorklogSubmitResult>;
  expectedMinutes: number;
  override: ExpectedHoursOverride | null;
}) {
  const [busy, startTransitionWrapper] = useTransitionWrapper();
  const { setMsg } = useContext(ToastContext);
  const router = useRouter();
  const [value, setValue] = useState<WorklogFormDataEntry>({
    day: day,
    from: defaults.fromDefault,
    to: defaults.toDefault,
    comment: '',
    subtractLunchBreak: NEW_WORKLOG_DEFAULT_SUBTRACT_LUNCH,
  });
  const [wl, setWl] = useState(worklogs);
  const [inputsValid, setInputsValid] = useState(true);

  // An overlap comes back as a question. It is answered *after* the wrapper has
  // settled rather than inside its callback, because the guard is still held
  // while the callback runs — a retry issued from there would be dropped as a
  // re-entrant call. Retrying from `then` puts the second write through the
  // guard cleanly, so the confirmed save is protected too.
  const submit = (allowOverlap = false) => {
    let outcome: WorklogSubmitResult | null = null;
    const action = () => {
      assertIsISODay(value.day, 'Invalid day');
      assertIsTime(value.from, 'Invalid from time');
      assertIsTime(value.to, 'Invalid to time');
      return onSubmit(
        {
          ...value,
          from: toDate(value.day, value.from),
          to: toDate(value.day, value.to),
        },
        { allowOverlap },
      );
    };
    startTransitionWrapper(action, (result: WorklogSubmitResult) => {
      outcome = result;
      if (result.status === 'success') {
        setWl(sortWorklogs([...wl, result.worklog]));
      }
    })
      .then((ran) => {
        // A dropped submission reports nothing at all.
        if (!ran || !outcome) {
          return;
        }
        const result: WorklogSubmitResult = outcome;
        if (result.status === 'success') {
          setMsg({ type: 'success', message: 'Worklog created' });
          return;
        }
        if (result.status === 'conflict') {
          if (confirmOverlap(result)) {
            submit(true);
          }
          // Declining writes nothing and leaves the form as the user left it.
          return;
        }
        setMsg({
          type: 'error',
          message: failureToastMessage(
            'Failed to create worklog',
            result.message,
          ),
        });
      })
      .catch((e) => {
        setMsg({
          type: 'error',
          message: errorToastMessage('Failed to create worklog', e),
        });
      });
  };

  const ref = useRef<HTMLDivElement>(null);
  const { onSwipeLeft, onSwipeRight } = useSwipeEvents(
    ref as unknown as React.RefObject<HTMLElement>,
    {
      threshold: 80,
      preventDefault: false,
    },
  );
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
          <div className="w-full text-center">
            <DayExpectedOverride
              day={day}
              expectedMinutes={expectedMinutes}
              override={override}
            />
          </div>
          {/* An absence claims the whole day, but it does not close the day to
              entry: hours logged on top are additional work and raise the
              saldo. Derived from the same state the list below renders, so it
              clears as soon as the absence is deleted. */}
          {wl.some((worklog) => worklog.absence) ? (
            <div
              role="note"
              className="alert alert-info text-sm w-full mt-3 mb-4"
            >
              An absence is recorded for this day. Hours you log here are still
              added to your saldo.
            </div>
          ) : null}
          <WorklogInputs
            value={value}
            setValue={setValue}
            anchor={defaults.fromDefault}
            onValidityChange={setInputsValid}
          />
          <button
            className="btn btn-secondary mt-3 w-full"
            disabled={!inputsValid || busy}
            onClick={() => submit()}
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
