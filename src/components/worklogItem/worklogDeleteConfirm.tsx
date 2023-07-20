'use client';

import { onWorklogDelete } from '@/actions';
import Modal from '../modal';
import { useTransitionWrapper } from '@/util/useTransitionWrapper';

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

  const deleteWorklog = () => {
    startTransitionWrapper(
      () => onWorklogDelete(worklogId),
      () => {
        onDelete(worklogId);
      },
    );
  };
  return (
    <Modal id={confirmId} confirmLabel="Delete" confirmAction={deleteWorklog}>
      <h3 className="font-bold text-lg">Confirmation</h3>
      <p className="py-4">Are you sure you want to delete this worklog?</p>
    </Modal>
  );
}
