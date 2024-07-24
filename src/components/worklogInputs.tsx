import { WorklogFormDataEntry } from '@/types';
import { Dispatch, SetStateAction } from 'react';
import TimeInput from './form/timeInput';
import Checkbox from './form/checkbox';
import { Date_Time } from '@/util/dateFormatter';
import { timeIsGt } from '@/util/date';

export default function WorklogInputs({
  value,
  setValue,
}: {
  value: WorklogFormDataEntry;
  setValue: Dispatch<SetStateAction<WorklogFormDataEntry>>;
}) {
  const updateFrom = (time?: Date_Time) => {
    const newFrom = time ?? '';
    const newTo =
      newFrom && value.to && timeIsGt(newFrom, value.to) ? newFrom : value.to;
    setValue({ ...value, from: newFrom, to: newTo });
  };
  const updateTo = (time?: Date_Time) => {
    const newTo = time ?? '';
    const newFrom =
      newTo && value.from && timeIsGt(value.from, newTo) ? newTo : value.from;
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
