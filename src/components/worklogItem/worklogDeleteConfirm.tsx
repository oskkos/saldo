'use client';

import { onWorklogDelete } from '@/actions';
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';

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

  return (
    <dialog id={confirmId} className="modal modal-bottom sm:modal-middle">
      <form method="dialog" className="modal-box">
        <h3 className="font-bold text-lg">Confirmation</h3>
        <p className="py-4">Are you sure you want to delete this worklog?</p>
        <div className="modal-action">
          <button className="btn">Cancel</button>
          <button
            className="btn btn-primary"
            onClick={() => {
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
            }}
          >
            Delete
          </button>
        </div>
      </form>
    </dialog>
  );
}
