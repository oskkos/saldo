'use client';
import { useContext, useState } from 'react';
import WorklogInputs from './worklogInputs';
import { Date_Time, toISODay } from '@/util/dateFormatter';
import { onWorklogSubmit } from '@/actions';
import { NEW_WORKLOG_DEFAULT_SUBTRACT_LUNCH } from '@/constants';
import Modal from './modal';
import DateInput from './form/dateInput';
import { Worklog, WorklogFormDataEntry, WorklogSubmitResult } from '@/types';
import { useTransitionWrapper } from '@/util/useTransitionWrapper';
import { ToastContext } from './toastContext';
import { toWorklogFormData } from '@/util/worklogFormData';
import { errorToastMessage, failureToastMessage } from './errorToast';

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
  const [inputsValid, setInputsValid] = useState(true);
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
      (result: WorklogSubmitResult) => {
        if (result.status === 'success') {
          onSubmit(result.worklog);
          setMsg({ type: 'success', message: 'Worklog created' });
          return;
        }
        setMsg({
          type: 'error',
          message: failureToastMessage(
            'Failed to create worklog',
            result.message,
          ),
        });
      },
    ).catch((e) => {
      setMsg({
        type: 'error',
        message: errorToastMessage('Failed to create worklog', e),
      });
    });
  };
  return (
    <Modal
      id={modalId}
      confirmLabel="Save"
      confirmAction={saveWorklog}
      confirmDisabled={!inputsValid}
    >
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
        <WorklogInputs
          value={value}
          setValue={setValue}
          anchor={defaults.fromDefault}
          onValidityChange={setInputsValid}
        />
      </div>
    </Modal>
  );
}
