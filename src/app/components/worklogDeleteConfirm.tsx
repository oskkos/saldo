'use client';

export function showDeleteConfirmModal(confirmId: string) {
  (
    window[confirmId as unknown as number] as unknown as { showModal(): void }
  ).showModal();
}

export default function WorklogDeleteConfirm({
  worklogId,
  confirmId,
  onDelete,
}: {
  worklogId: number;
  confirmId: string;
  onDelete: (id: number) => void;
}) {
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
              onDelete(worklogId);
            }}
          >
            Delete
          </button>
        </div>
      </form>
    </dialog>
  );
}
