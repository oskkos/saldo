'use client';
import { useState, useTransition } from 'react';
import { Worklog } from '@prisma/client';
import { useRouter } from 'next/navigation';
import { toDate } from '@/util/date';
import WorklogInputs from './worklogInputs';
import { Date_ISODay, Date_Time, toISODay } from '@/util/dateFormatter';
import { onWorklogSubmit } from '@/actions';
import {
  NEW_WORKLOG_DEFAULT_FROM,
  NEW_WORKLOG_DEFAULT_SUBTRACT_LUNCH,
  NEW_WORKLOG_DEFAULT_TO,
} from '@/constants';
import { assertExists, assertIsISODay } from '@/util/assertionFunctions';
import Modal from './modal';

export default function QuickAddWorklogModal({
  userId,
  modalId,
  onSubmit,
}: {
  userId: number;
  modalId: string;
  onSubmit: (worklog: Worklog) => void;
}) {
  const [, setTransition] = useTransition();
  const router = useRouter();
  const [value, setValue] = useState<{
    day?: Date_ISODay;
    comment: string;
    from: Date_Time;
    to: Date_Time;
    subtractLunchBreak: boolean;
  }>({
    day: toISODay(new Date()),
    comment: '',
    from: NEW_WORKLOG_DEFAULT_FROM,
    to: NEW_WORKLOG_DEFAULT_TO,
    subtractLunchBreak: NEW_WORKLOG_DEFAULT_SUBTRACT_LUNCH,
  });

  const saveWorklog = () => {
    assertExists(value.day);
    const ret = {
      ...value,
      from: toDate(`${value.day} ${value.from}`),
      to: toDate(`${value.day} ${value.to}`),
    };
    setTransition(() => {
      onWorklogSubmit(userId, ret)
        .then((worklog) => {
          onSubmit(worklog);
          router.refresh(); // https://github.com/vercel/next.js/issues/52350
        })
        .catch(() => {
          throw new Error('Failed to add worklog');
        });
    });
  };
  return (
    <Modal id={modalId} confirmLabel="Save" confirmAction={saveWorklog}>
      <h3 className="font-bold text-lg">Add new worklog</h3>

      <div className="flex flex-wrap justify-between items-center m-3">
        <input
          type="date"
          placeholder="Date"
          className="input input-bordered w-full mb-3"
          value={value.day}
          onChange={(e) => {
            assertIsISODay(e.target.value);
            setValue({ ...value, day: e.target.value });
          }}
        />
        <WorklogInputs value={value} setValue={setValue} />
      </div>
    </Modal>
  );
}
