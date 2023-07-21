'use client';
import { useContext, useState } from 'react';
import WorklogInputs from '../worklogInputs';
import { Worklog } from '@prisma/client';
import { toISODay, toTime } from '@/util/dateFormatter';
import { onWorklogEdit } from '@/actions';
import { toDate } from '@/util/date';
import { WorklogFormDataEntry } from '@/types';
import { assertIsISODay, assertIsTime } from '@/util/assertionFunctions';
import Modal from '../modal';
import { useTransitionWrapper } from '@/util/useTransitionWrapper';
import { ToastContext } from '../toastContext';

export default function WorklogEditModal({
  worklog,
  editModalId,
  onEdit,
}: {
  worklog: Worklog;
  editModalId: string;
  onEdit: (editedWorklog: Worklog) => void;
}) {
  const [, startTransitionWrapper] = useTransitionWrapper();
  const { setMsg } = useContext(ToastContext);
  const [value, setValue] = useState<WorklogFormDataEntry>({
    day: toISODay(worklog.from),
    from: toTime(worklog.from),
    to: toTime(worklog.to),
    comment: worklog.comment ?? '',
    subtractLunchBreak: worklog.subtract_lunch_break,
  });

  const editWorklog = () => {
    assertIsISODay(value.day, 'Day is required');
    assertIsTime(value.from, 'From is required');
    assertIsTime(value.to, 'To is required');
    const ret = {
      ...value,
      from: toDate(value.day, value.from),
      to: toDate(value.day, value.to),
    };
    startTransitionWrapper(() => onWorklogEdit(worklog.id, ret), onEdit)
      .then(() => {
        setMsg({ type: 'success', message: 'Worklog updated' });
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
              <div>Failed to update worklog</div>
              {errorMsg}
            </div>
          ),
        });
      });
  };
  return (
    <Modal id={editModalId} confirmLabel="Edit" confirmAction={editWorklog}>
      <h3 className="font-bold text-lg">Edit worklog</h3>
      <div className="flex flex-wrap justify-between items-center m-3 sm:w-11/12">
        <WorklogInputs value={value} setValue={setValue} />
      </div>
    </Modal>
  );
}
