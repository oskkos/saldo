import { absenceReasonToString } from '@/services';
import { AbsenceReason } from '@/types';
import { throwUnsupportedEnumMember } from '@/util';
import { GiPalmTree } from 'react-icons/gi';
import { MdMoreTime, MdOutlineSick, MdWorkOff } from 'react-icons/md';

export default function AbsenceIcon({
  absence,
  className,
  title,
}: {
  absence: AbsenceReason;
  className?: string;
  // Overrides the reason label. The calendar uses it to say what else the day
  // holds, which is the only channel there for something a tint alone implies.
  title?: string;
}) {
  const label = title ?? absenceReasonToString(absence);
  switch (absence) {
    case AbsenceReason.holiday:
      return <GiPalmTree className={className} title={label} />;
    case AbsenceReason.sick_leave:
      return <MdOutlineSick className={className} title={label} />;
    case AbsenceReason.flex_hours:
      return <MdMoreTime className={className} title={label} />;
    case AbsenceReason.other:
      return <MdWorkOff className={className} title={label} />;
    default:
      throwUnsupportedEnumMember(absence);
  }
}
