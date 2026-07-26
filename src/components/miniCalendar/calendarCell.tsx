import { AbsenceReason } from '@/types';
import { absenceReasonToString } from '@/services';
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
  // A day cell is a 40px circle, and its sub-line sits where the circle is
  // narrowest — there is no room for the reason icon and an hours figure side
  // by side. So work done on an absence day marks the icon instead of adding a
  // second figure: a tint to say the day holds more than the absence, and a
  // label naming the hours for anyone who hovers or listens rather than looks.
  // The figure itself lives in the day view.
  const worked = absence && subText;
  return (
    <div className="flex flex-col justify-center items-center">
      <div className={className}>{mainText}</div>
      {absence ? (
        <AbsenceIcon
          absence={absence}
          className={`w-4 h-4 sm:w-6 sm:h-6 ${worked ? 'text-success' : ''}`}
          title={
            worked
              ? `${absenceReasonToString(absence)}, ${subText} logged`
              : undefined
          }
        />
      ) : (
        <div className="text-xs/4 sm:text-sm/6">{subText ?? ' '}</div>
      )}
    </div>
  );
}
