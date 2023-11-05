import { AbsenceReason } from '@/types';
import AbsenceIcon from '../worklogItem/absenceIcon';

export default function CalendarCell({
  mainText,
  subText,
  absence,
  className,
}: {
  mainText: string | number;
  subText?: string;
  absence?: AbsenceReason;
  className?: string;
}) {
  return (
    <div className="flex flex-col justify-center items-center">
      <div className={className}>{mainText}</div>
      {absence ? (
        <AbsenceIcon absence={absence} className="w-4 h-4 sm:w-6 sm:h-6" />
      ) : (
        <div className="text-xs/4 sm:text-sm/6">{subText ?? '\u00A0'}</div>
      )}
    </div>
  );
}
