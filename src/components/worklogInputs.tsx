import { WorklogFormDataEntry } from '@/types';
import { Date_Time } from '@/util/dateFormatter';
import { Dispatch, SetStateAction } from 'react';

export default function WorklogInputs({
  value,
  setValue,
}: {
  value: WorklogFormDataEntry;
  setValue: Dispatch<SetStateAction<WorklogFormDataEntry>>;
}) {
  return (
    <>
      <input
        type="time"
        placeholder="From"
        value={value.from}
        className="input input-bordered w-[45%]"
        onChange={(e) =>
          setValue({ ...value, from: e.target.value as Date_Time })
        }
      />
      -
      <input
        type="time"
        placeholder="To"
        value={value.to}
        className="input input-bordered w-[45%]"
        onChange={(e) =>
          setValue({ ...value, to: e.target.value as Date_Time })
        }
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
