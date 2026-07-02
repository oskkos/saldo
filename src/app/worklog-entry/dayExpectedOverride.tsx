'use client';

import { useContext, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ExpectedHoursOverride } from '@/types';
import {
  onExpectedHoursOverrideDelete,
  onExpectedHoursOverrideUpsert,
} from '@/actions';
import Modal, { closeModal, showModal } from '@/components/modal';
import ExpectedHoursFields from '@/components/expectedHoursFields';
import { Date_ISODay, toDayMonthYear } from '@/util/dateFormatter';
import { startOfDay } from '@/util/date';
import { useTransitionWrapper } from '@/util/useTransitionWrapper';
import { ToastContext } from '@/components/toastContext';
import { errorToastMessage } from '@/components/errorToast';
import { MdEdit } from 'react-icons/md';

const formatMinutes = (m: number) => `${Math.floor(m / 60)}h ${m % 60}min`;
const MODAL_ID = 'expected-override-modal';

export default function DayExpectedOverride({
  day,
  expectedMinutes,
  override,
}: {
  day: Date_ISODay;
  expectedMinutes: number;
  override: ExpectedHoursOverride | null;
}) {
  const router = useRouter();
  const [, startTransitionWrapper] = useTransitionWrapper();
  const { setMsg } = useContext(ToastContext);
  const [hours, setHours] = useState<number | ''>(
    Math.floor(expectedMinutes / 60),
  );
  const [mins, setMins] = useState<number | ''>(expectedMinutes % 60);
  const [label, setLabel] = useState(override?.label ?? '');

  // Reset the fields to the day's current values before opening, so a prior
  // cancelled edit doesn't linger.
  const open = () => {
    setHours(Math.floor(expectedMinutes / 60));
    setMins(expectedMinutes % 60);
    setLabel(override?.label ?? '');
    showModal(MODAL_ID);
  };

  const save = () => {
    startTransitionWrapper(
      () =>
        onExpectedHoursOverrideUpsert({
          date: startOfDay(day),
          minutes: (hours || 0) * 60 + (mins || 0),
          label: label.trim() || undefined,
        }),
      () => router.refresh(),
    )
      .then(() =>
        setMsg({ type: 'success', message: 'Expected hours updated' }),
      )
      .catch((e) =>
        setMsg({
          type: 'error',
          message: errorToastMessage('Failed to update expected hours', e),
        }),
      );
  };

  const clear = () => {
    if (!override) {
      return;
    }
    startTransitionWrapper(
      () => onExpectedHoursOverrideDelete(override.id),
      () => {
        closeModal(MODAL_ID);
        router.refresh();
      },
    )
      .then(() => setMsg({ type: 'success', message: 'Override cleared' }))
      .catch((e) =>
        setMsg({
          type: 'error',
          message: errorToastMessage('Failed to clear override', e),
        }),
      );
  };

  return (
    <>
      <p className="text-sm opacity-80 mb-2">
        Expected today: {formatMinutes(expectedMinutes)}
        {override ? ' (custom)' : ''}{' '}
        <MdEdit
          title="Edit"
          className="inline h-5 w-5 cursor-pointer text-primary align-text-bottom ml-1"
          onClick={open}
        />
      </p>
      <Modal
        id={MODAL_ID}
        confirmLabel="Save"
        confirmAction={save}
        secondaryLabel={override ? 'Clear' : undefined}
        secondaryAction={override ? clear : undefined}
        secondaryClassName="btn-error btn-outline"
      >
        <h3 className="font-bold text-lg">
          Expected hours for {toDayMonthYear(day)}
        </h3>
        <div className="flex flex-col gap-2 mt-3">
          <ExpectedHoursFields
            hours={hours}
            mins={mins}
            label={label}
            onHours={setHours}
            onMins={setMins}
            onLabel={setLabel}
          />
        </div>
      </Modal>
    </>
  );
}
