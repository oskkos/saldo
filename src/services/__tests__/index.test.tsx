import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import {
  calculateCurrentSaldo,
  calculateWorklogsSum,
  sortWorklogs,
  absenceReasonToString,
  resolveExpectedMinutes,
  expectedMinutesByDay,
} from '../index';
import {
  AbsenceReason,
  ExpectedHoursOverride,
  Settings,
  Worklog,
} from '@/types';
import { Date_ISODay } from '@/util/dateFormatter';

describe('worklog calculator', () => {
  describe('calculateCurrentSaldo', () => {
    it('should calculate the current saldo correctly', () => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2023-10-22T10:00:00').getTime());

      const settings = {
        beginDate: new Date('2023-10-14'),
        initialBalanceHours: 2,
        initialBalanceMins: 30,
        expectedMinutesPerDay: 450,
      } as Settings;
      const worklogs = [
        {
          // friday before begin date, is ignored
          from: new Date('2023-10-13T08:00:00'),
          to: new Date('2023-10-13T16:00:00'),
          subtractLunchBreak: true,
        },
        {
          // sat flex hours, is ignored
          absence: 'flex_hours',
          from: new Date('2023-10-14T08:00:00'),
          to: new Date('2023-10-14T16:00:00'),
        },
        {
          // sun 10-12 without break (+2 hour)
          from: new Date('2023-10-15T10:00:00'),
          to: new Date('2023-10-15T12:00:00'),
        },
        {
          // mon 8-16:30 without break (+1 hour)
          from: new Date('2023-10-16T08:00:00'),
          to: new Date('2023-10-16T16:30:00'),
          subtractLunchBreak: false,
        },
        {
          // tue 8-15:30 without break (+/- 0 hour)
          from: new Date('2023-10-17T08:00:00'),
          to: new Date('2023-10-17T15:30:00'),
        },
        {
          // wed 7-16:15 with lunch break (+1 hour 15 minutes)
          from: new Date('2023-10-18T07:00:00'),
          to: new Date('2023-10-18T16:15:00'),
          subtractLunchBreak: true,
        },
        {
          // thu flex day (-7.5 hour)
          absence: 'flex_hours',
          from: new Date('2023-10-19T08:00:00'),
          to: new Date('2023-10-19T16:00:00'),
        },
        {
          // fri holiday (+/- 0 hour)
          absence: 'holiday',
          from: new Date('2023-10-20T08:00:00'),
          to: new Date('2023-10-20T16:00:00'),
        },
        {
          // sat holiday, is ignored
          absence: 'holiday',
          from: new Date('2023-10-21T08:00:00'),
          to: new Date('2023-10-21T16:00:00'),
        },
        {
          // mon in future is ignored
          from: new Date('2023-10-23T08:00:00'),
          to: new Date('2023-10-23T16:30:00'),
          subtractLunchBreak: false,
        },
      ] as unknown as Worklog[];
      const saldo = calculateCurrentSaldo(settings, worklogs, []);
      expect(saldo).toEqual({
        hours: -0,
        minutes: -45,
        toString: expect.any(Function),
        toBadge: expect.any(Function),
      });
      expect(saldo.toString()).toBe('-0h 45min');
    });

    it('is timezone-independent for a begin date at the UTC day boundary', () => {
      // beginDate at UTC midnight is the edge case where local-time day math
      // mis-counts the working day. With UTC math the result is the same in any
      // runtime timezone (the suite is pinned to a non-UTC zone). One full
      // expected day worked → saldo 0; local math would report 7h30.
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2023-10-16T20:00:00.000Z').getTime());

      const settings = {
        beginDate: new Date('2023-10-16T00:00:00.000Z'), // Monday, UTC midnight
        initialBalanceHours: 0,
        initialBalanceMins: 0,
        expectedMinutesPerDay: 450,
      } as Settings;
      const worklogs = [
        {
          // Mon 08:00-15:30 UTC, no lunch → 7.5h = exactly one expected day
          from: new Date('2023-10-16T08:00:00.000Z'),
          to: new Date('2023-10-16T15:30:00.000Z'),
          subtractLunchBreak: false,
        },
      ] as unknown as Worklog[];

      const saldo = calculateCurrentSaldo(settings, worklogs, []);
      expect(saldo.toString()).toBe('0h 0min');
    });
  });

  describe('calculateWorklogsSum', () => {
    it('should calculate the sum of all worklogs correctly', () => {
      const worklogs = [
        {
          from: new Date('2023-02-01T08:00:00'),
          to: new Date('2023-02-01T10:00:00'),
        },
        {
          absence: 'holiday',
          from: new Date('2023-02-02T08:00:00'),
          to: new Date('2023-02-02T10:00:00'),
        },
        {
          from: new Date('2023-02-03T12:00:00'),
          to: new Date('2023-02-03T13:30:00'),
          subtractLunchBreak: true,
        },
      ] as unknown as Worklog[];
      const sum = calculateWorklogsSum(worklogs);
      expect(sum).toEqual({
        hours: 5,
        minutes: 0,
        toString: expect.any(Function),
        toBadge: expect.any(Function),
      });
      expect(sum.toString()).toBe('5h 0min');
    });
  });

  describe('sortWorklogs', () => {
    it('should sort the worklogs in descending order by date', () => {
      const worklogs = [
        {
          from: new Date('2023-02-03T12:00:00'),
          to: new Date('2023-02-03T13:30:00'),
        },
        {
          from: new Date('2023-02-02T08:00:00'),
          to: new Date('2023-02-02T10:00:00'),
        },
        {
          from: new Date('2023-02-01T08:00:00'),
          to: new Date('2023-02-01T10:00:00'),
        },
      ];
      const sorted = sortWorklogs(worklogs as Worklog[]);
      expect(sorted).toEqual([
        {
          from: new Date('2023-02-03T12:00:00'),
          to: new Date('2023-02-03T13:30:00'),
        },
        {
          from: new Date('2023-02-02T08:00:00'),
          to: new Date('2023-02-02T10:00:00'),
        },
        {
          from: new Date('2023-02-01T08:00:00'),
          to: new Date('2023-02-01T10:00:00'),
        },
      ]);
    });
  });

  describe('absenceReasonToString', () => {
    it('should convert an absence reason to a human-friendly string', () => {
      const reasons = ['holiday', 'flex_hours', 'sick_leave', 'other'] as const;
      const pretty = reasons.map((r) =>
        absenceReasonToString(r as AbsenceReason),
      );
      expect(pretty).toEqual(['Holiday', 'Flex hours', 'Sick leave', 'Other']);
    });
  });

  describe('resolveExpectedMinutes', () => {
    const mk = (dateStr: string, minutes: number): ExpectedHoursOverride => ({
      id: 1,
      date: new Date(dateStr),
      minutes,
      label: null,
    });

    it('returns the default on a working day with no override', () => {
      const map = new Map<Date_ISODay, number>();
      expect(resolveExpectedMinutes(new Date('2023-10-16'), 450, map)).toBe(
        450,
      );
    });

    it('returns 0 on a non-working day with no override', () => {
      const map = new Map<Date_ISODay, number>();
      expect(resolveExpectedMinutes(new Date('2023-10-14'), 450, map)).toBe(0);
    });

    it('returns the override value when present', () => {
      const map = expectedMinutesByDay([mk('2023-10-16', 300)]);
      expect(resolveExpectedMinutes(new Date('2023-10-16'), 450, map)).toBe(
        300,
      );
    });

    it('lets an override win over the weekend rule', () => {
      const map = expectedMinutesByDay([mk('2023-10-14', 300)]);
      expect(resolveExpectedMinutes(new Date('2023-10-14'), 450, map)).toBe(
        300,
      );
    });
  });

  describe('calculateCurrentSaldo with expected-hours configuration', () => {
    const monday = '2023-10-16T00:00:00.000Z';
    const settings = (expectedMinutesPerDay: number) =>
      ({
        beginDate: new Date(monday),
        initialBalanceHours: 0,
        initialBalanceMins: 0,
        expectedMinutesPerDay,
      }) as Settings;
    const override = (minutes: number): ExpectedHoursOverride => ({
      id: 1,
      date: new Date(monday),
      minutes,
      label: null,
    });

    beforeEach(() => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2023-10-16T20:00:00.000Z').getTime());
    });

    it('nets to zero when a short-day override is worked in full', () => {
      const worklogs = [
        {
          // 08:00-13:00 UTC = 5h = 300min, no lunch
          from: new Date('2023-10-16T08:00:00.000Z'),
          to: new Date('2023-10-16T13:00:00.000Z'),
          subtractLunchBreak: false,
        },
      ] as unknown as Worklog[];
      const saldo = calculateCurrentSaldo(settings(450), worklogs, [
        override(300),
      ]);
      expect(saldo.toString()).toBe('0h 0min');
    });

    it('keeps an absence on an overridden day balance-neutral', () => {
      const worklogs = [
        {
          absence: 'holiday',
          from: new Date('2023-10-16T08:00:00.000Z'),
          to: new Date('2023-10-16T16:00:00.000Z'),
        },
      ] as unknown as Worklog[];
      const saldo = calculateCurrentSaldo(settings(450), worklogs, [
        override(300),
      ]);
      expect(saldo.toString()).toBe('0h 0min');
    });

    it('accrues the configurable default instead of a fixed 7.5h', () => {
      const worklogs = [
        {
          // 6h worked against a 6h default → net 0
          from: new Date('2023-10-16T08:00:00.000Z'),
          to: new Date('2023-10-16T14:00:00.000Z'),
          subtractLunchBreak: false,
        },
      ] as unknown as Worklog[];
      const saldo = calculateCurrentSaldo(settings(360), worklogs, []);
      expect(saldo.toString()).toBe('0h 0min');
    });
  });
});
