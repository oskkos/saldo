'use client';
import { useContext, useState } from 'react';
import WorklogInputs from '../worklogInputs';
import { toISODay, toTime } from '@/util/dateFormatter';
import { onWorklogEdit } from '@/actions';
import { Worklog, WorklogFormDataEntry, WorklogSubmitResult } from '@/types';
import Modal, { closeModal } from '../modal';
import { useTransitionWrapper } from '@/util/useTransitionWrapper';
import { confirmOverlap } from '@/util/confirmOverlap';
import { ToastContext } from '../toastContext';
import { toWorklogFormData } from '@/util/worklogFormData';
import { errorToastMessage, failureToastMessage } from '../errorToast';

export default function WorklogEditModal({
  worklog,
  editModalId,
  onEdit,
}: {
  worklog: Worklog;
  editModalId: string;
  onEdit: (editedWorklog: Worklog) => void;
}) {
  const [busy, startTransitionWrapper] = useTransitionWrapper();
  const { setMsg } = useContext(ToastContext);
  const [inputsValid, setInputsValid] = useState(true);
  const [value, setValue] = useState<WorklogFormDataEntry>({
    day: toISODay(worklog.from),
    from: toTime(worklog.from),
    to: toTime(worklog.to),
    comment: worklog.comment ?? '',
    subtractLunchBreak: worklog.subtractLunchBreak,
  });

  const editWorklog = (allowOverlap = false) => {
    let outcome: WorklogSubmitResult | null = null;
    startTransitionWrapper(
      () =>
        onWorklogEdit(worklog.id, toWorklogFormData(value), { allowOverlap }),
      (result: WorklogSubmitResult) => {
        outcome = result;
        if (result.status === 'success') {
          onEdit(result.worklog);
        }
      },
    )
      .then((ran) => {
        if (!ran || !outcome) {
          return;
        }
        const result: WorklogSubmitResult = outcome;
        if (result.status === 'success') {
          closeModal(editModalId);
          setMsg({ type: 'success', message: 'Worklog updated' });
          return;
        }
        if (result.status === 'conflict') {
          // Declining leaves the modal open on the user's edited values.
          if (confirmOverlap(result)) {
            editWorklog(true);
          }
          return;
        }
        setMsg({
          type: 'error',
          message: failureToastMessage(
            'Failed to update worklog',
            result.message,
          ),
        });
      })
      .catch((e) => {
        setMsg({
          type: 'error',
          message: errorToastMessage('Failed to update worklog', e),
        });
      });
  };
  return (
    <Modal
      id={editModalId}
      confirmLabel="Edit"
      confirmAction={() => editWorklog()}
      confirmDisabled={!inputsValid || busy}
    >
      <h3 className="font-bold text-lg">Edit worklog</h3>
      <div className="flex flex-wrap justify-between items-center m-3 sm:w-11/12">
        <WorklogInputs
          value={value}
          setValue={setValue}
          anchor={toTime(worklog.from)}
          onValidityChange={setInputsValid}
        />
      </div>
    </Modal>
  );
}
