import { describe, expect, test } from '@jest/globals';
import {
  assertExists,
  assertIsAbsenceReason,
  assertIsISODay,
  assertIsTime,
  assertIsYearAndMonth,
} from '../assertionFunctions';

describe('assertionFunctions module', () => {
  describe('assertIsISODay', () => {
    test('should throw an error for an invalid date', () => {
      expect(() => assertIsISODay('2023-xx-yy')).toThrowError(
        'Not a valid ISO day: 2023-xx-yy',
      );
    });

    test('should not throw an error for a valid date', () => {
      expect(() => assertIsISODay('2023-02-01')).not.toThrow();
    });
  });

  describe('assertIsTime', () => {
    test('should throw an error for an invalid time', () => {
      expect(() => assertIsTime('xx:00')).toThrowError(
        'Not a valid Time: xx:00',
      );
    });

    test('should not throw an error for a valid time', () => {
      expect(() => assertIsTime('12:00')).not.toThrow();
    });
  });

  describe('assertIsYearAndMonth', () => {
    test('should throw an error for an invalid date', () => {
      expect(() => assertIsYearAndMonth('2023-aa')).toThrowError(
        'Not a valid YearAndMonth: 2023-aa',
      );
    });

    test('should not throw an error for a valid date', () => {
      expect(() => assertIsYearAndMonth('2023-01')).not.toThrow();
    });
  });

  describe('assertExists', () => {
    test('should throw an error for a null value', () => {
      expect(() => assertExists(null, 'Value should not be null')).toThrowError(
        'Value should not be null',
      );
    });

    test('should throw an error for an undefined value', () => {
      expect(() =>
        assertExists(undefined, 'Value should not be undefined'),
      ).toThrowError('Value should not be undefined');
    });

    test('should not throw an error for a defined value', () => {
      const value: string = 'test';
      expect(() => assertExists(value)).not.toThrow();
    });
  });

  describe('assertIsAbsenceReason', () => {
    test('should throw an error for an invalid absence reason', () => {
      expect(() => assertIsAbsenceReason('sick')).toThrowError(
        'Not a valid absence reason: sick',
      );
    });

    test('should not throw an error for a valid absence reason', () => {
      expect(() => assertIsAbsenceReason('holiday')).not.toThrow();
    });
  });
});
