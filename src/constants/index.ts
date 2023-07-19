import { assertIsTime } from '@/util/assertionFunctions';

const defaultFrom = '08:00';
assertIsTime(defaultFrom);
const defaultTo = '16:00';
assertIsTime(defaultTo);

export const EXPECTED_HOURS_PER_DAY = 7.5;
export const EXPECTED_MINUTES_LUNCH_BREAK = 30;
export const NEW_WORKLOG_DEFAULT_FROM = defaultFrom;
export const NEW_WORKLOG_DEFAULT_TO = defaultTo;
export const NEW_WORKLOG_DEFAULT_SUBTRACT_LUNCH = true;
