import { WorklogFormDataEntry } from '@/types';
import { Dispatch, SetStateAction } from 'react';
import TimeInput from './form/timeInput';
import Checkbox from './form/checkbox';

export default function WorklogInputs({
  value,
  setValue,
}: {
  value: WorklogFormDataEntry;
  setValue: Dispatch<SetStateAction<WorklogFormDataEntry>>;
}) {
  return (
    <>
      <TimeInput
        placeholder="From"
        value={value.from}
        className="w-[45%]"
        onChange={(time) => {
          setValue({ ...value, from: time ?? '' });
        }}
      />
      -
      <TimeInput
        placeholder="To"
        value={value.to}
        className="w-[45%]"
        onChange={(time) => {
          setValue({ ...value, to: time ?? '' });
        }}
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
