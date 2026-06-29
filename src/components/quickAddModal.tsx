'use client';
import { useContext, useState } from 'react';
import WorklogInputs from './worklogInputs';
import { Date_Time, toISODay } from '@/util/dateFormatter';
import { onWorklogSubmit } from '@/actions';
import { NEW_WORKLOG_DEFAULT_SUBTRACT_LUNCH } from '@/constants';
import Modal from './modal';
import DateInput from './form/dateInput';
import { Worklog, WorklogFormDataEntry } from '@/types';
import { useTransitionWrapper } from '@/util/useTransitionWrapper';
import { ToastContext } from './toastContext';
import { toWorklogFormData } from '@/util/worklogFormData';
import { errorToastMessage } from './errorToast';

export default function QuickAddWorklogModal({
  modalId,
  defaults,
  onSubmit,
}: {
  modalId: string;
  defaults: { fromDefault: Date_Time; toDefault: Date_Time };
  onSubmit: (worklog: Worklog) => void;
}) {
  const [, startTransitionWrapper] = useTransitionWrapper();
  const { setMsg } = useContext(ToastContext);
  const [value, setValue] = useState<WorklogFormDataEntry>({
    day: toISODay(),
    comment: '',
    from: defaults.fromDefault,
    to: defaults.toDefault,
    subtractLunchBreak: NEW_WORKLOG_DEFAULT_SUBTRACT_LUNCH,
  });

  const saveWorklog = () => {
    startTransitionWrapper(
      () => onWorklogSubmit(toWorklogFormData(value)),
      onSubmit,
    )
      .then(() => {
        setMsg({ type: 'success', message: 'Worklog created' });
      })
      .catch((e) => {
        setMsg({
          type: 'error',
          message: errorToastMessage('Failed to create worklog', e),
        });
      });
  };
  return (
    <Modal id={modalId} confirmLabel="Save" confirmAction={saveWorklog}>
      <h3 className="font-bold text-lg">Add new worklog</h3>

      <div className="flex flex-wrap justify-between items-center m-3">
        <DateInput
          value={value.day}
          placeholder="Date"
          className="w-full mb-3"
          onChange={(day) => {
            setValue({ ...value, day: day ?? '' });
          }}
        />
        <WorklogInputs value={value} setValue={setValue} />
      </div>
    </Modal>
  );
}
