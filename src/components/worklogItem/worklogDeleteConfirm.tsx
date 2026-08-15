'use client';

import { onWorklogDelete } from '@/actions';
import Modal, { closeModal } from '../modal';
import { useTransitionWrapper } from '@/util/useTransitionWrapper';
import { useContext } from 'react';
import { ToastContext } from '../toastContext';

export default function WorklogDeleteConfirm({
  worklogId,
  confirmId,
  onDelete,
}: {
  worklogId: number;
  confirmId: string;
  onDelete: (id: number) => void;
}) {
  const [busy, startTransitionWrapper] = useTransitionWrapper();
  const { setMsg } = useContext(ToastContext);

  const deleteWorklog = () => {
    startTransitionWrapper(
      () => onWorklogDelete(worklogId),
      () => {
        // Close before dropping the row: `onDelete` unmounts this component
        // along with its <dialog>, and `closeModal` would then look up an
        // element that no longer exists.
        closeModal(confirmId);
        onDelete(worklogId);
      },
    )
      .then((ran) => {
        if (ran) {
          setMsg({ type: 'success', message: 'Worklog deleted' });
        }
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
              <div>Failed to delete worklog</div>
              {errorMsg}
            </div>
          ),
        });
      });
  };
  return (
    <Modal
      id={confirmId}
      confirmLabel="Delete"
      confirmAction={deleteWorklog}
      confirmDisabled={busy}
    >
      <h3 className="font-bold text-lg">Confirmation</h3>
      <p className="py-4">Are you sure you want to delete this worklog?</p>
    </Modal>
  );
}
