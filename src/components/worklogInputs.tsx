import { WorklogFormDataEntry } from '@/types';
import { Dispatch, SetStateAction, useState } from 'react';
import TimeInput from './form/timeInput';
import IntegerInput from './form/integerInput';
import Checkbox from './form/checkbox';
import { Date_Time } from '@/util/dateFormatter';
import { timeIsGt } from '@/util/date';
import { durationToTimeRange, netMinutesFromTimes } from '@/util/duration';

type Mode = 'times' | 'duration';

export default function WorklogInputs({
  value,
  setValue,
  anchor,
  onValidityChange,
  allowDuration = true,
}: {
  value: WorklogFormDataEntry;
  setValue: Dispatch<SetStateAction<WorklogFormDataEntry>>;
  // Start time to anchor Duration mode on: the existing worklog's `from` when
  // editing, the user's default start (fromDefault) when creating.
  anchor: Date_Time;
  onValidityChange?: (valid: boolean) => void;
  // The clock-out flow has real start/end times, so it opts out of Duration mode
  // and stays Times-only.
  allowDuration?: boolean;
}) {
  const [mode, setMode] = useState<Mode>('times');
  const [hours, setHours] = useState<number | ''>('');
  const [minutes, setMinutes] = useState<number | ''>('');
  const [durationError, setDurationError] = useState<string | null>(null);

  // In Times mode a worklog is valid once both ends are filled (the handlers
  // below keep from <= to). Report it so the parent's submit gate covers this
  // path too, not just Duration mode.
  const reportTimesValidity = (from: Date_Time | '', to: Date_Time | '') => {
    onValidityChange?.(!!from && !!to);
  };
  const updateFrom = (time?: Date_Time) => {
    const newFrom = time ?? '';
    const newTo =
      newFrom && value.to && timeIsGt(newFrom, value.to) ? newFrom : value.to;
    setValue({ ...value, from: newFrom, to: newTo });
    reportTimesValidity(newFrom, newTo);
  };
  const updateTo = (time?: Date_Time) => {
    const newTo = time ?? '';
    const newFrom =
      newTo && value.from && timeIsGt(value.from, newTo) ? newTo : value.from;
    setValue({ ...value, from: newFrom, to: newTo });
    reportTimesValidity(newFrom, newTo);
  };

  // The duration entered is net worked time, so the lunch break is folded in and
  // the stored flag is cleared. On overflow / non-positive input we clear `to`
  // and report invalidity so the parent can block submit; the inline error tells
  // the user why.
  const applyDuration = (h: number | '', m: number | '') => {
    const total = (h === '' ? 0 : h) * 60 + (m === '' ? 0 : m);
    let error: string | null = null;
    let to: Date_Time | null = null;

    // Guard total <= 0 before calling durationToTimeRange: the anchor is always
    // >= 0 minutes, so only a non-positive total could yield a negative end, and
    // minutesToTime would then build an out-of-range string and throw. The
    // inputs are also clamped (see below), so this is defense in depth.
    if (total <= 0) {
      error = 'Duration must be greater than zero';
    } else {
      const range = durationToTimeRange(anchor, total);
      if (range.overflow || !range.to) {
        error = `Duration is too long for a start of ${anchor}`;
      } else {
        to = range.to;
      }
    }

    setDurationError(error);
    setValue({
      ...value,
      from: anchor,
      to: to ?? '',
      subtractLunchBreak: false,
    });
    onValidityChange?.(!error);
  };

  const switchMode = (next: Mode) => {
    if (next === mode) {
      return;
    }
    if (next === 'duration') {
      const net =
        value.from && value.to
          ? Math.max(
              0,
              netMinutesFromTimes(
                value.from,
                value.to,
                value.subtractLunchBreak,
              ),
            )
          : 0;
      const h = Math.floor(net / 60);
      const m = net % 60;
      setHours(h);
      setMinutes(m);
      applyDuration(h, m);
    } else {
      // Back to Times: if a duration error had blanked `to`, this correctly
      // reports invalid so the submit gate stays closed until it is refilled.
      setDurationError(null);
      reportTimesValidity(value.from, value.to);
    }
    setMode(next);
  };

  return (
    <>
      {allowDuration ? (
        <div className="flex w-full justify-center mb-8">
          <label className="flex cursor-pointer items-center gap-3">
            <span className="label-text">Times</span>
            <input
              type="checkbox"
              // Keep the knob the same shade in both states (daisyUI dims it when
              // unchecked): neither mode is "on", so only the position differs.
              className="toggle text-base-content"
              aria-label="Enter as duration"
              checked={mode === 'duration'}
              onChange={(e) =>
                switchMode(e.target.checked ? 'duration' : 'times')
              }
            />
            <span className="label-text">Duration</span>
          </label>
        </div>
      ) : null}

      {mode === 'times' ? (
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
        </>
      ) : (
        <div>
          <IntegerInput
            placeholder="Hours"
            label=""
            value={hours}
            className="w-16"
            min={0}
            onChange={(val) => {
              const h = val === undefined ? '' : Math.max(0, val);
              setHours(h);
              applyDuration(h, minutes);
            }}
          />{' '}
          Hours
          <IntegerInput
            placeholder="Minutes"
            label=""
            value={minutes}
            className="w-16 ml-4"
            min={0}
            max={59}
            onChange={(val) => {
              const m = val === undefined ? '' : Math.min(59, Math.max(0, val));
              setMinutes(m);
              applyDuration(hours, m);
            }}
          />{' '}
          Minutes
          {durationError ? (
            <p className="text-error text-sm mt-2 w-full">{durationError}</p>
          ) : null}
        </div>
      )}

      <textarea
        className="textarea textarea-bordered mt-3 w-full"
        placeholder="Comment"
        value={value.comment}
        onChange={(e) => setValue({ ...value, comment: e.target.value })}
      ></textarea>
    </>
  );
}
