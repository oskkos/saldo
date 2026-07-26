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
  // An absence and logged hours are not alternatives: working during one is a
  // supported day, and hiding the hours behind the icon would leave that work
  // with no trace on the calendar. The icon gives up some size when it has to
  // share the row — a 40px cell has no room for both at full size.
  const shareRow = absence && subText;
  return (
    <div className="flex flex-col justify-center items-center">
      <div className={className}>{mainText}</div>
      {absence ? (
        <div className="flex items-center justify-center gap-0.5 leading-none">
          <AbsenceIcon
            absence={absence}
            className={
              shareRow ? 'w-3 h-3 sm:w-4 sm:h-4' : 'w-4 h-4 sm:w-6 sm:h-6'
            }
          />
          {subText ? (
            <span className="text-[0.625rem]/4 sm:text-sm/6">{subText}</span>
          ) : null}
        </div>
      ) : (
        <div className="text-xs/4 sm:text-sm/6">{subText ?? '\u00A0'}</div>
      )}
    </div>
  );
}
