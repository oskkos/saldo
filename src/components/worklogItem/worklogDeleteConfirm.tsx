'use client';

import { onWorklogDelete } from '@/actions';
import Modal from '../modal';
import { useTransitionWrapper } from '@/util/useTransitionWrapper';
import useToastMessage from '@/util/useToastMessage';

export default function WorklogDeleteConfirm({
  worklogId,
  confirmId,
  onDelete,
}: {
  worklogId: number;
  confirmId: string;
  onDelete: (id: number) => void;
}) {
  const [, startTransitionWrapper] = useTransitionWrapper();
  const [ToastMsg, setMsg] = useToastMessage();

  const deleteWorklog = () => {
    startTransitionWrapper(
      () => onWorklogDelete(worklogId),
      () => {
        onDelete(worklogId);
      },
    )
      .then(() => {
        setMsg({ type: 'success', message: 'Worklog deleted' });
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
    <>
      <ToastMsg />
      <Modal id={confirmId} confirmLabel="Delete" confirmAction={deleteWorklog}>
        <h3 className="font-bold text-lg">Confirmation</h3>
        <p className="py-4">Are you sure you want to delete this worklog?</p>
      </Modal>
    </>
  );
}
