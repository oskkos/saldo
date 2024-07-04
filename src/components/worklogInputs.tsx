import { WorklogFormDataEntry } from '@/types';
import { Dispatch, SetStateAction } from 'react';
import TimeInput from './form/timeInput';
import Checkbox from './form/checkbox';
import { Date_Time } from '@/util/dateFormatter';

export default function WorklogInputs({
  value,
  setValue,
}: {
  value: WorklogFormDataEntry;
  setValue: Dispatch<SetStateAction<WorklogFormDataEntry>>;
}) {
  const isGt = (a: Date_Time, b: Date_Time) => {
    const a_split = a.split(':');
    const b_split = b.split(':');

    if (parseInt(a_split[0]) > parseInt(b_split[0])) {
      return true;
    } else if (parseInt(a_split[0]) === parseInt(b_split[0])) {
      if (parseInt(a_split[1]) > parseInt(b_split[1])) {
        return true;
      }
    }
    return false;
  };

  const updateFrom = (time?: Date_Time) => {
    const newFrom = time ?? '';
    const newTo =
      newFrom && value.to && isGt(newFrom, value.to) ? newFrom : value.to;
    setValue({ ...value, from: newFrom, to: newTo });
  };
  const updateTo = (time?: Date_Time) => {
    const newTo = time ?? '';
    const newFrom =
      newTo && value.from && isGt(value.from, newTo) ? newTo : value.from;
    setValue({ ...value, from: newFrom, to: newTo });
  };

  return (
    <>
      <TimeInput
        placeholder="From"
        value={value.from}
        className="w-[45%]"
        onChange={updateFrom}
      />
      -
      <TimeInput
        placeholder="To"
        value={value.to}
        className="w-[45%]"
        onChange={updateTo}
      />
      <div className="form-control ml-2 mt-3 w-full">
        <Checkbox
          label="Subtract lunch break automatically"
          checked={value.subtractLunchBreak}
          onChange={(checked) => {
            setValue({
              ...value,
              subtractLunchBreak: checked,
            });
          }}
        />
      </div>
      <textarea
        className="textarea textarea-bordered mt-3 w-full"
        placeholder="Comment"
        value={value.comment}
        onChange={(e) => setValue({ ...value, comment: e.target.value })}
      ></textarea>
    </>
  );
}
