import { EXPECTED_MINUTES_LUNCH_BREAK } from '@/constants';
import { Date_Time } from './dateFormatter';
import { assertIsTime } from './assertionFunctions';

const MINUTES_IN_DAY = 24 * 60;

// Format a non-negative minute count as "Hh Mmin" (e.g. 300 -> "5h 0min").
export function formatMinutes(minutes: number) {
  return `${Math.floor(minutes / 60)}h ${minutes % 60}min`;
}

export function timeToMinutes(time: Date_Time) {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

function minutesToTime(totalMinutes: number): Date_Time {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const str = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(
    2,
    '0',
  )}`;
  assertIsTime(str);
  return str;
}

// Given a start anchor and a net worked duration in minutes, produce the from/to
// time pair for the entry. `overflow` is true when the end would cross into the
// next day (>= 24:00), in which case `to` is null and the caller must reject the
// entry — a duration entry always falls on a single day.
export function durationToTimeRange(
  anchor: Date_Time,
  durationMinutes: number,
) {
  const end = timeToMinutes(anchor) + durationMinutes;
  const overflow = end >= MINUTES_IN_DAY;
  return {
    from: anchor,
    to: overflow ? null : minutesToTime(end),
    overflow,
  };
}

// Net worked minutes for a from/to time pair, mirroring worklogMinutes in the
// services layer: the raw span minus the lunch break when it is subtracted. Used
// to prefill Duration mode from an existing (Times-mode) entry.
export function netMinutesFromTimes(
  from: Date_Time,
  to: Date_Time,
  subtractLunchBreak: boolean,
) {
  return (
    timeToMinutes(to) -
    timeToMinutes(from) -
    (subtractLunchBreak ? EXPECTED_MINUTES_LUNCH_BREAK : 0)
  );
}
