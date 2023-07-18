import { absenceReasonToString } from '@/services';
import { AbsenceReason } from '@/types';
import { throwUnsupportedEnumMember } from '@/util';
import { GiPalmTree } from 'react-icons/gi';
import { MdMoreTime, MdOutlineSick, MdWorkOff } from 'react-icons/md';

export default function AbsenceIcon({
  absence,
  className,
}: {
  absence: AbsenceReason;
  className?: string;
}) {
  switch (absence) {
    case AbsenceReason.holiday:
      return (
        <GiPalmTree
          className={className}
          title={absenceReasonToString(absence)}
        />
      );
    case AbsenceReason.sick_leave:
      return (
        <MdOutlineSick
          className={className}
          title={absenceReasonToString(absence)}
        />
      );
    case AbsenceReason.flex_hours:
      return (
        <MdMoreTime
          className={className}
          title={absenceReasonToString(absence)}
        />
      );
    case AbsenceReason.other:
      return (
        <MdWorkOff
          className={className}
          title={absenceReasonToString(absence)}
        />
      );
    default:
      throwUnsupportedEnumMember(absence);
  }
}
