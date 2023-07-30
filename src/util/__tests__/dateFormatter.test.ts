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
});
