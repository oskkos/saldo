import { describe, expect, test } from '@jest/globals';
import * as dateFormatter from '@/util/dateFormatter';
import { assertIsISODay, assertIsYearAndMonth } from '../assertionFunctions';

describe('dateFormatter module', () => {
  test('toDay', () => {
    expect(dateFormatter.toDay(new Date('2023-07-01T01:23:45.678Z'))).toBe('1');
    expect(dateFormatter.toDay(new Date('2023-07-31T01:23:45.678Z'))).toBe(
      '31',
    );
  });

  test('toDayMonthYear', () => {
    expect(
      dateFormatter.toDayMonthYear(new Date('2023-07-01T01:23:45.678Z')),
    ).toBe('1.7.2023');

    const d = '2023-07-01';
    assertIsISODay(d);
    expect(dateFormatter.toDayMonthYear(d)).toBe('1.7.2023');
  });

  test('toISODay', () => {
    expect(dateFormatter.toISODay(new Date('2023-07-01T01:23:45.678Z'))).toBe(
      '2023-07-01',
    );
  });

  test('toMonthAndYear', () => {
    expect(
      dateFormatter.toMonthAndYear(new Date('2023-07-01T01:23:45.678Z')),
    ).toBe('July 2023');

    const d = '2023-07';
    assertIsYearAndMonth(d);
    expect(dateFormatter.toMonthAndYear(d)).toBe('July 2023');
  });

  test('toTime', () => {
    expect(dateFormatter.toTime(new Date('2023-07-01T01:23:45.678Z'))).toBe(
      '01:23',
    );
  });

  test('toWeek', () => {
    expect(dateFormatter.toWeek(new Date('2023-07-03T01:23:45.678Z'))).toBe(27);
  });

  test('toWeekday', () => {
    expect(dateFormatter.toWeekday(new Date('2023-07-02T01:23:45.678Z'))).toBe(
      0,
    );
    expect(dateFormatter.toWeekday(new Date('2023-07-03T01:23:45.678Z'))).toBe(
      1,
    );
    expect(dateFormatter.toWeekday(new Date('2023-07-08T01:23:45.678Z'))).toBe(
      6,
    );
  });

  test('toYearAndWeek', () => {
    expect(
      dateFormatter.toYearAndWeek(new Date('2023-07-03T01:23:45.678Z')),
    ).toBe('2023-27');
  });

  test('toYearAndMonth', () => {
    expect(
      dateFormatter.toYearAndMonth(new Date('2023-07-01T01:23:45.678Z')),
    ).toBe('2023-07');

    const d = '2023-07-01';
    assertIsISODay(d);
    expect(dateFormatter.toYearAndMonth(d)).toBe('2023-07');
  });

  // Low-UTC-hour instants that fall on the previous calendar day in negative-
  // offset timezones (e.g. 02:30Z is 22:30 the day before in America/New_York).
  // These assert the UTC contract of the formatters. NOTE: on the UTC CI runner
  // these pass trivially; a regression to local-time formatting would only be
  // caught when the suite runs under a non-UTC timezone, which requires the
  // whole suite to be timezone-robust (see the date.ts follow-up in the saldo
  // spec). They are kept as documentation of the intended UTC output.
  describe('UTC day boundary', () => {
    // 02:30Z on 2023-07-01 is 2023-06-30 22:30 in America/New_York.
    const justAfterUtcMidnight = new Date('2023-07-01T02:30:00.000Z');

    test('day-level formatters use the UTC date', () => {
      expect(dateFormatter.toISODay(justAfterUtcMidnight)).toBe('2023-07-01');
      expect(dateFormatter.toDay(justAfterUtcMidnight)).toBe('1');
      expect(dateFormatter.toDayMonthYear(justAfterUtcMidnight)).toBe(
        '1.7.2023',
      );
      expect(dateFormatter.toWeekday(justAfterUtcMidnight)).toBe(6); // Saturday
    });

    // 03:00Z on 2023-08-01 is 2023-07-31 23:00 in America/New_York.
    const justAfterUtcMonthStart = new Date('2023-08-01T03:00:00.000Z');

    test('month-level formatters use the UTC date', () => {
      expect(dateFormatter.toMonthAndYear(justAfterUtcMonthStart)).toBe(
        'August 2023',
      );
      expect(dateFormatter.toYearAndMonth(justAfterUtcMonthStart)).toBe(
        '2023-08',
      );
      expect(dateFormatter.toISODay(justAfterUtcMonthStart)).toBe('2023-08-01');
    });

    test('toTime uses the UTC clock', () => {
      expect(dateFormatter.toTime(justAfterUtcMidnight)).toBe('02:30');
    });
  });
});
