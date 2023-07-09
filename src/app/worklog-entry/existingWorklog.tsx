import { Worklog } from '@prisma/client';
import { MdDelete, MdModeEdit } from 'react-icons/md';
import WorklogTitle from './worklogTitle';

function showConfirm(confirmId: string) {
  (
    window[confirmId as unknown as number] as unknown as { showModal(): void }
  ).showModal();
}

export default function ExistingWorklog({
  worklog,
  onDelete,
}: {
  worklog: Worklog;
  onDelete: (id: number) => void;
}) {
  const confirmId = `worklog-delete-confirm-${worklog.id}`;
  return (
    <div className="card w-full bg-base-200 shadow-xl mt-4">
      <div className="card-body pr-4">
        <div className="flex justify-between">
          <WorklogTitle worklog={worklog} />
          <div className="card-actions justify-end w-16">
            <MdModeEdit
              className="w-6 h-6"
              onClick={() => {
                console.log('xx');
              }}
            />
            <MdDelete
              className="w-6 h-6"
              onClick={() => showConfirm(confirmId)}
            />
          </div>
        </div>
        {worklog.comment ? <p>{worklog.comment}</p> : null}
      </div>
      <dialog id={confirmId} className="modal modal-bottom sm:modal-middle">
        <form method="dialog" className="modal-box">
          <h3 className="font-bold text-lg">Confirmation</h3>
          <p className="py-4">Are you sure you want to delete this worklog?</p>
          <div className="modal-action">
            <button className="btn">Cancel</button>
            <button
              className="btn btn-primary"
              onClick={() => {
                onDelete(worklog.id);
              }}
            >
              Delete
            </button>
          </div>
        </form>
      </dialog>
    </div>
  );
}
