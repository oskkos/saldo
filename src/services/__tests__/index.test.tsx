import { describe, expect, it, jest } from '@jest/globals';
import {
  calculateCurrentSaldo,
  calculateWorklogsSum,
  sortWorklogs,
  absenceReasonToString,
} from '../index';
import { Settings, Worklog } from '@prisma/client';
import { AbsenceReason } from '@/types';

describe('worklog calculator', () => {
  describe('calculateCurrentSaldo', () => {
    it('should calculate the current saldo correctly', () => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2023-10-22T10:00:00').getTime());

      const settings = {
        begin_date: new Date('2023-10-14'),
        initial_balance_hours: 2,
        initial_balance_mins: 30,
      } as Settings;
      const worklogs = [
        {
          // friday before begin date, is ignored
          from: new Date('2023-10-13T08:00:00'),
          to: new Date('2023-10-13T16:00:00'),
          subtract_lunch_break: true,
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
          subtract_lunch_break: false,
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
          subtract_lunch_break: true,
        },
        {
          // thu flex day (-7.5 hour)
          absence: 'flex_hours',
          from: new Date('2023-10-19T08:00:00'),
          to: new Date('2023-10-19T16:00:00'),
        },
        {
          // fri vacation (+/- 0 hour)
          absence: 'vacation',
          from: new Date('2023-10-20T08:00:00'),
          to: new Date('2023-10-20T16:00:00'),
        },
        {
          // sat vacation, is ignored
          absence: 'vacation',
          from: new Date('2023-10-21T08:00:00'),
          to: new Date('2023-10-21T16:00:00'),
        },
        {
          // mon in future is ignored
          from: new Date('2023-10-23T08:00:00'),
          to: new Date('2023-10-23T16:30:00'),
          subtract_lunch_break: false,
        },
      ] as unknown as Worklog[];
      const saldo = calculateCurrentSaldo(settings, worklogs);
      expect(saldo).toEqual({
        hours: -0,
        minutes: -45,
        toString: expect.any(Function),
        toBadge: expect.any(Function),
      });
      expect(saldo.toString()).toBe('-0h 45min');
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
          absence: 'vacation',
          from: new Date('2023-02-02T08:00:00'),
          to: new Date('2023-02-02T10:00:00'),
        },
        {
          from: new Date('2023-02-03T12:00:00'),
          to: new Date('2023-02-03T13:30:00'),
          subtract_lunch_break: true,
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
      const reasons = [
        'sick_leave',
        'vacation',
        'unpaid_leave',
        'flex_hours',
        'other',
      ] as const;
      const pretty = reasons.map((r) =>
        absenceReasonToString(r as AbsenceReason),
      );
      expect(pretty).toEqual([
        'Sick leave',
        'Vacation',
        'Unpaid leave',
        'Flex hours',
        'Other',
      ]);
    });
  });
});
