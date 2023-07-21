'use client';
import { useState } from 'react';
import { Worklog } from '@prisma/client';
import { toDate } from '@/util/date';
import WorklogInputs from './worklogInputs';
import { toISODay } from '@/util/dateFormatter';
import { onWorklogSubmit } from '@/actions';
import {
  NEW_WORKLOG_DEFAULT_FROM,
  NEW_WORKLOG_DEFAULT_SUBTRACT_LUNCH,
  NEW_WORKLOG_DEFAULT_TO,
} from '@/constants';
import { assertExists } from '@/util/assertionFunctions';
import Modal from './modal';
import DateInput from './form/dateInput';
import { WorklogFormDataEntry } from '@/types';
import { useTransitionWrapper } from '@/util/useTransitionWrapper';
import useToastMessage from '@/util/useToastMessage';

export default function QuickAddWorklogModal({
  userId,
  modalId,
  onSubmit,
}: {
  userId: number;
  modalId: string;
  onSubmit: (worklog: Worklog) => void;
}) {
  const [, startTransitionWrapper] = useTransitionWrapper();
  const [ToastMsg, setMsg] = useToastMessage();
  const [value, setValue] = useState<WorklogFormDataEntry>({
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
    startTransitionWrapper(() => onWorklogSubmit(userId, ret), onSubmit)
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
  };
  return (
    <>
      <ToastMsg />
      <Modal id={modalId} confirmLabel="Save" confirmAction={saveWorklog}>
        <h3 className="font-bold text-lg">Add new worklog</h3>

        <div className="flex flex-wrap justify-between items-center m-3">
          <DateInput
            value={value.day}
            placeholder="Date"
            className="w-full mb-3"
            onChange={(day) => {
              assertExists(day);
              setValue({ ...value, day: day });
            }}
          />
          <WorklogInputs value={value} setValue={setValue} />
        </div>
      </Modal>
    </>
  );
}
