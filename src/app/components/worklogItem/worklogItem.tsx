'use client';
import { Worklog } from '@prisma/client';
import { MdDelete, MdModeEdit } from 'react-icons/md';
import WorklogTitle from '../../worklog-entry/worklogTitle';
import WorklogDeleteConfirm, {
  showDeleteConfirmModal,
} from './worklogDeleteConfirm';
import { useEffect, useState } from 'react';
import WorklogEditModal, { showWorklogEditModal } from './worklogEditModal';

export default function WorklogItem({
  worklog,
  onDelete,
  onEdit,
  ignored,
}: {
  worklog: Worklog;
  ignored?: boolean;
  onDelete: (id: number) => void;
  onEdit: (editedWorklog: Worklog) => void;
}) {
  const confirmId = `worklog-delete-confirm-${worklog.id}`;
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  useEffect(() => {
    if (showDeleteConfirm) {
      showDeleteConfirmModal(confirmId);
      setShowDeleteConfirm(false);
    }
  }, [showDeleteConfirm, confirmId]);

  const editModalId = `worklog-edit-modal-${worklog.id}`;
  const [showEdit, setShowEdit] = useState(false);
  useEffect(() => {
    if (showEdit) {
      showWorklogEditModal(editModalId);
      setShowEdit(false);
    }
  }, [showEdit, editModalId]);

  return (
    <div
      className={`card w-full shadow-xl mt-4 ${
        ignored ? 'bg-base-100' : 'bg-base-200'
      }`}
    >
      <div className={`card-body pr-4 ${ignored ? 'text-base-300' : ''}`}>
        <div className="flex justify-between">
          <WorklogTitle worklog={worklog} />
          <div className="card-actions justify-end w-16">
            <MdModeEdit
              className="w-6 h-6 cursor-pointer"
              onClick={() => setShowEdit(true)}
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
      <WorklogEditModal
        editModalId={editModalId}
        worklog={worklog}
        onEdit={onEdit}
      />
    </div>
  );
}
