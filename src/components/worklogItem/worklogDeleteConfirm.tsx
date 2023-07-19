'use client';

import { onWorklogDelete } from '@/actions';
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import Modal from '../modal';

export default function WorklogDeleteConfirm({
  worklogId,
  confirmId,
  onDelete,
}: {
  worklogId: number;
  confirmId: string;
  onDelete: (id: number) => void;
}) {
  const [, setTransition] = useTransition();
  const router = useRouter();

  const deleteWorklog = () => {
    setTransition(() => {
      onWorklogDelete(worklogId)
        .then(() => {
          onDelete(worklogId);
          router.refresh(); // https://github.com/vercel/next.js/issues/52350
        })
        .catch(() => {
          throw new Error('Failed to delete worklog');
        });
    });
  };
  return (
    <Modal id={confirmId} confirmLabel="Delete" confirmAction={deleteWorklog}>
      <h3 className="font-bold text-lg">Confirmation</h3>
      <p className="py-4">Are you sure you want to delete this worklog?</p>
    </Modal>
  );
}
