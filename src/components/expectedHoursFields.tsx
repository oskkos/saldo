import IntegerInput from './form/integerInput';

// Shared Hours:Minutes + optional label inputs for an expected-hours value.
// Used by the settings "Special days" add form and the day-view override modal
// so the two entry points offer identical fields (the day view fixes the date,
// so it lives outside this component).
export default function ExpectedHoursFields({
  hours,
  mins,
  label,
  onHours,
  onMins,
  onLabel,
}: {
  hours: number | '';
  mins: number | '';
  label: string;
  onHours: (val: number | '') => void;
  onMins: (val: number | '') => void;
  onLabel: (val: string) => void;
}) {
  return (
    <>
      <div className="flex items-center mt-4">
        <IntegerInput
          label="Hours"
          value={hours}
          className="w-20"
          placeholder="hh"
          min={0}
          max={24}
          onChange={(val) => onHours(val ?? '')}
        />
        <span className="mx-3">:</span>
        <IntegerInput
          label="Minutes"
          value={mins}
          className="w-20"
          placeholder="mm"
          min={0}
          max={59}
          onChange={(val) => onMins(val ?? '')}
        />
      </div>
      <input
        type="text"
        className="input input-bordered w-full"
        placeholder="Label (optional)"
        value={label}
        maxLength={100}
        onChange={(e) => onLabel(e.target.value)}
      />
    </>
  );
}
