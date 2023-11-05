import { describe, expect, test } from '@jest/globals';
import * as date from '@/util/date';
import {
  assertIsISODay,
  assertIsTime,
  assertIsYearAndMonth,
} from '../assertionFunctions';

describe('date module', () => {
  test('add day', () => {
    expect(date.add(new Date('2023-07-31T01:23:45.678Z'), 1, 'day')).toEqual(
      new Date('2023-08-01T01:23:45.678Z'),
    );
    const d = '2023-07-31';
    assertIsISODay(d);
    expect(date.add(d, 1, 'day')).toEqual(new Date('2023-08-01T00:00:00.000Z'));
  });
  test('add month', () => {
    expect(date.add(new Date('2024-01-29T00:00:00Z'), 1, 'month')).toEqual(
      new Date('2024-02-29T00:00:00.000Z'),
    );
    const d = '2024-01-29';
    assertIsISODay(d);
    expect(date.add(d, 1, 'month')).toEqual(
      new Date('2024-02-29T00:00:00.000Z'),
    );
  });
  test('add year', () => {
    expect(date.add(new Date('2024-02-21T00:00:00Z'), 1, 'year')).toEqual(
      new Date('2025-02-21T00:00:00.000Z'),
    );
    expect(date.add(new Date('2024-02-29T00:00:00Z'), 1, 'year')).toEqual(
      new Date('2025-02-28T00:00:00.000Z'),
    );
    const d = '2024-02-29';
    assertIsISODay(d);
    expect(date.add(d, 1, 'year')).toEqual(
      new Date('2025-02-28T00:00:00.000Z'),
    );
  });

  test('days in month', () => {
    expect(date.daysInMonth(new Date('2023-02-01T00:00:00Z'))).toBe(28);
    expect(date.daysInMonth(new Date('2024-02-02T00:00:00Z'))).toBe(29);
    expect(date.daysInMonth(new Date('2023-06-03T00:00:00Z'))).toBe(30);
    expect(date.daysInMonth(new Date('2023-07-31T00:00:00Z'))).toBe(31);
  });

  test('diff in minutes', () => {
    expect(
      date.diffInMinutes(
        new Date('2024-01-30T00:00:00.999Z'),
        new Date('2024-01-30T00:00:00.000Z'),
      ),
    ).toBe(0);
    expect(
      date.diffInMinutes(
        new Date('2024-01-30T00:00:59.999Z'),
        new Date('2024-01-30T00:00:00.000Z'),
      ),
    ).toBe(0);
    expect(
      date.diffInMinutes(
        new Date('2024-01-30T00:59:59.999Z'),
        new Date('2024-01-30T00:00:00.000Z'),
      ),
    ).toBe(59);
    expect(
      date.diffInMinutes(
        new Date('2024-01-30T23:59:59.999Z'),
        new Date('2024-01-30T00:00:00.999Z'),
      ),
    ).toBe(1439);
    expect(
      date.diffInMinutes(
        new Date('2024-01-31T00:00:00.000Z'),
        new Date('2024-01-30T00:00:00.000Z'),
      ),
    ).toBe(1440);
  });

  test('end of day', () => {
    expect(date.endOfDay(new Date('2024-02-02T00:00:00Z'))).toEqual(
      new Date('2024-02-02T23:59:59.999Z'),
    );
    const d = '2024-02-02';
    assertIsISODay(d);
    expect(date.endOfDay(d)).toEqual(new Date('2024-02-02T23:59:59.999Z'));
  });

  test('end of month', () => {
    expect(date.endOfMonth(new Date('2024-02-02T00:00:00Z'))).toEqual(
      new Date('2024-02-29T23:59:59.999Z'),
    );
  });

  test('now', () => {
    const d = new Date();
    const now = date.now();
    const expectedDiff = d.getTimezoneOffset();
    expect(date.diffInMinutes(d, now)).toBe(expectedDiff);
  });

  test('same day', () => {
    expect(
      date.sameDay(
        new Date('2024-02-04T00:00:00Z'),
        new Date('2024-02-03T23:59:59Z'),
      ),
    ).toBe(false);
    expect(
      date.sameDay(
        new Date('2024-02-02T00:00:00Z'),
        new Date('2024-02-03T23:59:59Z'),
      ),
    ).toBe(false);
    expect(
      date.sameDay(
        new Date('2024-02-02T00:00:00Z'),
        new Date('2024-02-02T23:59:59Z'),
      ),
    ).toBe(true);
  });

  test('start of day', () => {
    expect(date.startOfDay(new Date('2024-02-02T00:00:00Z'))).toEqual(
      new Date('2024-02-02T00:00:00.000Z'),
    );
    const d = '2024-02-02';
    assertIsISODay(d);
    expect(date.startOfDay(d)).toEqual(new Date('2024-02-02T00:00:00.000Z'));
  });

  test('start of month', () => {
    expect(date.startOfMonth(new Date('2024-02-02T00:00:00Z'))).toEqual(
      new Date('2024-02-01T00:00:00.000Z'),
    );
    const m = '2024-02';
    assertIsYearAndMonth(m);
    expect(date.startOfMonth(m)).toEqual(new Date('2024-02-01T00:00:00.000Z'));
  });

  test('subtract day', () => {
    expect(
      date.subtract(new Date('2023-07-31T01:23:45.678Z'), 1, 'day'),
    ).toEqual(new Date('2023-07-30T01:23:45.678Z'));
    const d = '2024-03-01';
    assertIsISODay(d);
    expect(date.subtract(d, 1, 'day')).toEqual(
      new Date('2024-02-29T00:00:00.000Z'),
    );
  });
  test('subtract month', () => {
    expect(date.subtract(new Date('2024-01-30T00:00:00Z'), 1, 'month')).toEqual(
      new Date('2023-12-30T00:00:00.000Z'),
    );
    const d = '2024-01-30';
    assertIsISODay(d);
    expect(date.subtract(d, 1, 'month')).toEqual(
      new Date('2023-12-30T00:00:00.000Z'),
    );
  });
  test('subtract year', () => {
    expect(date.subtract(new Date('2024-02-29T00:00:00Z'), 1, 'year')).toEqual(
      new Date('2023-02-28T00:00:00.000Z'),
    );
    const d = '2024-02-29';
    assertIsISODay(d);
    expect(date.subtract(d, 1, 'year')).toEqual(
      new Date('2023-02-28T00:00:00.000Z'),
    );
  });

  test('toDate', () => {
    const isoDate = '2024-02-29';
    assertIsISODay(isoDate);
    const time = '12:34';
    assertIsTime(time);
    expect(date.toDate(isoDate, time)).toEqual(
      new Date('2024-02-29T12:34:00.000Z'),
    );
  });

  test('isHoliday', () => {
    expect(date.isHoliday(new Date('2022-01-01T00:00:00Z'))).toBe(true);
    expect(date.isHoliday(new Date('2022-12-24T00:00:00Z'))).toBe(false);
    expect(date.isHoliday(new Date('2022-12-25T00:00:00Z'))).toBe(true);
    expect(date.isHoliday(new Date('2022-12-26T00:00:00Z'))).toBe(true);
    expect(date.isHoliday(new Date('2022-12-31T00:00:00Z'))).toBe(false);
    expect(date.isHoliday(new Date('2022-06-24T00:00:00Z'))).toBe(false);
    expect(date.isHoliday(new Date('2022-06-25T00:00:00Z'))).toBe(true);
    expect(date.isHoliday(new Date('2022-06-26T00:00:00Z'))).toBe(false);
  });

  test('isWeekend', () => {
    const saturday = new Date('2022-10-01T00:00:00.000Z');
    expect(date.isWeekend(saturday)).toBe(true);
    const sunday = new Date('2022-10-02T00:00:00.000Z');
    expect(date.isWeekend(sunday)).toBe(true);
    const monday = new Date('2022-10-03T00:00:00.000Z');
    expect(date.isWeekend(monday)).toBe(false);
    const tuesday = new Date('2022-10-04T00:00:00.000Z');
    expect(date.isWeekend(tuesday)).toBe(false);
    const wednesday = new Date('2022-10-05T00:00:00.000Z');
    expect(date.isWeekend(wednesday)).toBe(false);
    const thursday = new Date('2022-10-06T00:00:00.000Z');
    expect(date.isWeekend(thursday)).toBe(false);
    const friday = new Date('2022-10-07T00:00:00.000Z');
    expect(date.isWeekend(friday)).toBe(false);
  });
});
