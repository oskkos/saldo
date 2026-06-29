'use client';
import { useContext, useState } from 'react';
import WorklogInputs from '../worklogInputs';
import { toISODay, toTime } from '@/util/dateFormatter';
import { onWorklogEdit } from '@/actions';
import { Worklog, WorklogFormDataEntry } from '@/types';
import Modal from '../modal';
import { useTransitionWrapper } from '@/util/useTransitionWrapper';
import { ToastContext } from '../toastContext';
import { toWorklogFormData } from '@/util/worklogFormData';
import { errorToastMessage } from '../errorToast';

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
    subtractLunchBreak: worklog.subtractLunchBreak,
  });

  const editWorklog = () => {
    startTransitionWrapper(
      () => onWorklogEdit(worklog.id, toWorklogFormData(value)),
      onEdit,
    )
      .then(() => {
        setMsg({ type: 'success', message: 'Worklog updated' });
      })
      .catch((e) => {
        setMsg({
          type: 'error',
          message: errorToastMessage('Failed to update worklog', e),
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
