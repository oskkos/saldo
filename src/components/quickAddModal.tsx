'use client';
import { useContext, useState } from 'react';
import WorklogInputs from './worklogInputs';
import { Date_Time, toISODay } from '@/util/dateFormatter';
import { onWorklogSubmit } from '@/actions';
import { NEW_WORKLOG_DEFAULT_SUBTRACT_LUNCH } from '@/constants';
import Modal, { closeModal } from './modal';
import DateInput from './form/dateInput';
import { Worklog, WorklogFormDataEntry, WorklogSubmitResult } from '@/types';
import { useTransitionWrapper } from '@/util/useTransitionWrapper';
import { confirmOverlap } from '@/util/confirmOverlap';
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
  const [busy, startTransitionWrapper] = useTransitionWrapper();
  const { setMsg } = useContext(ToastContext);
  const [inputsValid, setInputsValid] = useState(true);
  const [value, setValue] = useState<WorklogFormDataEntry>({
    day: toISODay(),
    comment: '',
    from: defaults.fromDefault,
    to: defaults.toDefault,
    subtractLunchBreak: NEW_WORKLOG_DEFAULT_SUBTRACT_LUNCH,
  });

  // The overlap answer is handled once the wrapper has settled, not inside its
  // callback: the guard is still held there, so a retry issued from the callback
  // would be dropped as re-entrant. See worklogEntry for the same shape.
  const saveWorklog = (allowOverlap = false) => {
    let outcome: WorklogSubmitResult | null = null;
    startTransitionWrapper(
      () => onWorklogSubmit(toWorklogFormData(value), { allowOverlap }),
      (result: WorklogSubmitResult) => {
        outcome = result;
        if (result.status === 'success') {
          onSubmit(result.worklog);
        }
      },
    )
      .then((ran) => {
        if (!ran || !outcome) {
          return;
        }
        const result: WorklogSubmitResult = outcome;
        if (result.status === 'success') {
          // The dialog no longer dismisses itself on tap, so anything short of
          // success leaves the form open with the user's input intact.
          closeModal(modalId);
          setMsg({ type: 'success', message: 'Worklog created' });
          return;
        }
        if (result.status === 'conflict') {
          if (confirmOverlap(result)) {
            saveWorklog(true);
          }
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
  return (
    <Modal
      id={modalId}
      confirmLabel="Save"
      confirmAction={() => saveWorklog()}
      confirmDisabled={!inputsValid || busy}
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
