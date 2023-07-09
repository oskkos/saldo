'use client';
import { Worklog } from '@prisma/client';
import { MdDelete, MdModeEdit } from 'react-icons/md';
import WorklogTitle from './worklogTitle';
import WorklogDeleteConfirm, {
  showDeleteConfirmModal,
} from '../components/worklogDeleteConfirm';
import { useEffect, useState } from 'react';

export default function ExistingWorklog({
  worklog,
  onDelete,
}: {
  worklog: Worklog;
  onDelete: (id: number) => void;
}) {
  const confirmId = `worklog-delete-confirm-${worklog.id}`;

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  useEffect(() => {
    if (showDeleteConfirm) {
      showDeleteConfirmModal(confirmId);
      setShowDeleteConfirm(false);
    }
  }, [showDeleteConfirm, confirmId]);

  return (
    <div className="card w-full bg-base-200 shadow-xl mt-4">
      <div className="card-body pr-4">
        <div className="flex justify-between">
          <WorklogTitle worklog={worklog} />
          <div className="card-actions justify-end w-16">
            <MdModeEdit
              className="w-6 h-6 cursor-pointer"
              onClick={() => {
                console.log('xx');
              }}
            />
            <MdDelete
              className="w-6 h-6 cursor-pointer"
              onClick={() => setShowDeleteConfirm(true)}
            />
          </div>
        </div>
        {worklog.comment ? <p>{worklog.comment}</p> : null}
      </div>
      <WorklogDeleteConfirm
        confirmId={confirmId}
        worklogId={worklog.id}
        onDelete={onDelete}
      />
    </div>
  );
}
