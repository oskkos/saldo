import { WorklogFormDataEntry } from '@/types';
import { assertExists } from '@/util/assertionFunctions';
import { Dispatch, SetStateAction } from 'react';
import TimeInput from './form/timeInput';

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
          assertExists(time);
          setValue({ ...value, from: time });
        }}
      />
      -
      <TimeInput
        placeholder="To"
        value={value.to}
        className="w-[45%]"
        onChange={(time) => {
          assertExists(time);
          setValue({ ...value, to: time });
        }}
      />
      <div className="form-control ml-2 mt-3 w-full">
        <label className="label cursor-pointer">
          <span className="label-text">Subtract lunch break automatically</span>
          <input
            type="checkbox"
            className="toggle toggle-primary"
            checked={value.subtractLunchBreak}
            onChange={(e) => {
              setValue({
                ...value,
                subtractLunchBreak: e.target.checked,
              });
            }}
          />
        </label>
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
