'use client';
import { useEffect, useState } from 'react';
import { MdAdd } from 'react-icons/md';
import QuickAddWorklogModal from './quickAddModal';
import { showModal } from './modal';
import { Date_Time } from '@/util/dateFormatter';

export default function QuickAdd({
  defaults,
}: {
  defaults: { fromDefault: Date_Time; toDefault: Date_Time };
}) {
  const quickAddWorklogModalId = `worklog-new-worklog-modal`;
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  useEffect(() => {
    if (showQuickAdd) {
      showModal(quickAddWorklogModalId);
      setShowQuickAdd(false);
    }
  }, [showQuickAdd, quickAddWorklogModalId]);

  return (
    <>
      <MdAdd
        className="mr-2 p-1 rounded-full h-8 w-8 bg-secondary cursor-pointer"
        onClick={() => {
          setShowQuickAdd(true);
        }}
      />
      <QuickAddWorklogModal
        modalId={quickAddWorklogModalId}
        defaults={defaults}
        onSubmit={() => {
          setShowQuickAdd(false);
        }}
      />
    </>
  );
}
