import { WorklogFormData } from '@/types';
import { Dispatch, SetStateAction } from 'react';

export default function WorklogInputs({
  value,
  setValue,
}: {
  value: WorklogFormData;
  setValue: Dispatch<SetStateAction<WorklogFormData>>;
}) {
  return (
    <>
      <input
        type="time"
        placeholder="From"
        value={value.from}
        className="input input-bordered w-[45%]"
        onChange={(e) => setValue({ ...value, from: e.target.value })}
      />
      -
      <input
        type="time"
        placeholder="To"
        value={value.to}
        className="input input-bordered w-[45%]"
        onChange={(e) => setValue({ ...value, to: e.target.value })}
      />
      <textarea
        className="textarea textarea-bordered mt-3 w-full"
        placeholder="Comment"
        value={value.comment}
        onChange={(e) => setValue({ ...value, comment: e.target.value })}
      ></textarea>
    </>
  );
}
