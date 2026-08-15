import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { render } from '@testing-library/react';
import {
  calculateCurrentSaldo,
  calculateWorklogsSum,
  sortWorklogs,
  absenceReasonToString,
  resolveExpectedMinutes,
  expectedMinutesByDay,
  minutesToSaldoObject,
  worklogMinutes,
  daysInRange,
  absenceConflictMessage,
  spansOverlap,
  worklogOverlapMessage,
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
    // @scenario saldo/Worked example
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

    // @scenario saldo/Begin date at the UTC day boundary
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
    // @scenario saldo/Sum over a mixed list
    // The aggregation itself takes the list as given: every entry counts by its
    // own stored times, absence or not. Deciding which entries belong in the
    // list is the caller's job — see existingWorklogs, which leaves absences out.
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
    // @scenario absence/Label formatting
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

    // @scenario expected-hours/Default working day
    it('returns the default on a working day with no override', () => {
      const map = new Map<Date_ISODay, number>();
      expect(resolveExpectedMinutes(new Date('2023-10-16'), 450, map)).toBe(
        450,
      );
    });

    // @scenario expected-hours/Non-working day
    it('returns 0 on a non-working day with no override', () => {
      const map = new Map<Date_ISODay, number>();
      expect(resolveExpectedMinutes(new Date('2023-10-14'), 450, map)).toBe(0);
    });

    // @scenario saldo/A short day accrues its overridden expectation
    it('returns the override value when present', () => {
      const map = expectedMinutesByDay([mk('2023-10-16', 300)]);
      expect(resolveExpectedMinutes(new Date('2023-10-16'), 450, map)).toBe(
        300,
      );
    });

    // @scenario expected-hours/Override takes precedence over the weekend rule
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

    // @scenario saldo/Vacation on an overridden short day
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

describe('saldo specification scenarios', () => {
  // All dates are UTC; the suite runs in a non-UTC zone on purpose.
  const MONDAY = '2023-10-16T00:00:00.000Z';
  const settingsFor = (
    beginDate: string,
    initialBalanceHours = 0,
    initialBalanceMins = 0,
  ) =>
    ({
      beginDate: new Date(beginDate),
      initialBalanceHours,
      initialBalanceMins,
      expectedMinutesPerDay: 450,
    }) as Settings;

  const worklog = (props: Partial<Worklog> & { from: Date; to: Date }) =>
    props as unknown as Worklog;

  const at = (iso: string) => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(iso).getTime());
  };

  // @scenario saldo/Non-zero initial balance
  it('adds the initial balance to the worked total before worklogs count', () => {
    at(MONDAY);

    const withoutBalance = calculateCurrentSaldo(
      settingsFor(MONDAY),
      [],
      [],
    ).toString();
    const withBalance = calculateCurrentSaldo(
      settingsFor(MONDAY, 2, 30),
      [],
      [],
    ).toString();

    // One working day accrues 450 expected. 2h30 of initial balance is 150
    // minutes of credit against it: -450 becomes -300.
    expect(withoutBalance).toBe('-7h 30min');
    expect(withBalance).toBe('-5h 0min');
  });

  // @scenario saldo/Weekends and holidays do not raise the expectation
  it('accrues the default on working days and nothing on the weekend', () => {
    at(MONDAY);

    // Fri 13th and Mon 16th accrue 450 each; Sat 14th and Sun 15th accrue 0.
    const saldo = calculateCurrentSaldo(
      settingsFor('2023-10-13T00:00:00.000Z'),
      [],
      [],
    );

    expect(saldo.toString()).toBe('-15h 0min');
  });

  // @scenario saldo/Work logged on a Sunday counts
  it('counts work logged on a Sunday even though Sunday accrues nothing', () => {
    at('2023-10-15T20:00:00.000Z');

    const saldo = calculateCurrentSaldo(
      settingsFor('2023-10-15T00:00:00.000Z'),
      [
        worklog({
          from: new Date('2023-10-15T10:00:00.000Z'),
          to: new Date('2023-10-15T12:00:00.000Z'),
          subtractLunchBreak: false,
        }),
      ],
      [],
    );

    expect(saldo.toString()).toBe('2h 0min');
  });

  // @scenario saldo/Lunch break subtracted
  it('nets a 30-minute lunch break out of the worked minutes', () => {
    expect(
      worklogMinutes(
        worklog({
          from: new Date('2023-10-16T07:00:00.000Z'),
          to: new Date('2023-10-16T16:15:00.000Z'),
          subtractLunchBreak: true,
        }),
      ),
    ).toBe(525);
  });

  // @scenario saldo/Lunch break not subtracted
  it('keeps the whole span when no lunch break is subtracted', () => {
    expect(
      worklogMinutes(
        worklog({
          from: new Date('2023-10-16T08:00:00.000Z'),
          to: new Date('2023-10-16T16:30:00.000Z'),
          subtractLunchBreak: false,
        }),
      ),
    ).toBe(510);
  });

  // @scenario saldo/Entry the day before begin date
  it('ignores a worklog dated before the begin date', () => {
    at(MONDAY);
    const settings = settingsFor('2023-10-14T00:00:00.000Z');
    const dayBefore = worklog({
      from: new Date('2023-10-13T08:00:00.000Z'),
      to: new Date('2023-10-13T16:00:00.000Z'),
      subtractLunchBreak: false,
    });

    const withEntry = calculateCurrentSaldo(settings, [dayBefore], []);

    // Sat and Sun accrue nothing, Mon accrues 450, and the 13th contributes
    // nothing at all — so the entry leaves the balance where it was.
    expect(withEntry.toString()).toBe('-7h 30min');
    expect(withEntry.toString()).toBe(
      calculateCurrentSaldo(settings, [], []).toString(),
    );
  });

  // @scenario saldo/Entry dated tomorrow
  it('ignores a worklog dated after today', () => {
    at('2023-10-22T10:00:00.000Z');
    const settings = settingsFor('2023-10-22T00:00:00.000Z');
    const tomorrow = worklog({
      from: new Date('2023-10-23T08:00:00.000Z'),
      to: new Date('2023-10-23T16:00:00.000Z'),
      subtractLunchBreak: false,
    });

    const withEntry = calculateCurrentSaldo(settings, [tomorrow], []);

    // Sunday accrues nothing and the future entry contributes nothing.
    expect(withEntry.toString()).toBe('0h 0min');
    expect(withEntry.toString()).toBe(
      calculateCurrentSaldo(settings, [], []).toString(),
    );
  });

  // @scenario saldo/Flex day on a working day
  it('draws the balance down by a full day for a flex-hours absence', () => {
    at('2023-10-19T20:00:00.000Z');

    const saldo = calculateCurrentSaldo(
      settingsFor('2023-10-19T00:00:00.000Z'),
      [
        worklog({
          absence: AbsenceReason.flex_hours,
          from: new Date('2023-10-19T08:00:00.000Z'),
          to: new Date('2023-10-19T16:00:00.000Z'),
        }),
      ],
      [],
    );

    // 0 worked against 450 expected on a working Thursday.
    expect(saldo.toString()).toBe('-7h 30min');
  });

  // @scenario saldo/Vacation on a working Friday
  it('keeps a non-flex absence on a working day balance-neutral', () => {
    at('2023-10-20T20:00:00.000Z');

    const saldo = calculateCurrentSaldo(
      settingsFor('2023-10-20T00:00:00.000Z'),
      [
        worklog({
          absence: AbsenceReason.holiday,
          from: new Date('2023-10-20T08:00:00.000Z'),
          to: new Date('2023-10-20T16:00:00.000Z'),
        }),
      ],
      [],
    );

    // The stored 08:00-16:00 span is 480 minutes; crediting it would leave
    // +30. Netting to zero is what proves the resolved 450 was credited.
    expect(saldo.toString()).toBe('0h 0min');
  });

  // @scenario saldo/Vacation on a Saturday
  it('ignores an absence that falls on a non-working day', () => {
    at('2023-10-21T20:00:00.000Z');

    const saldo = calculateCurrentSaldo(
      settingsFor('2023-10-21T00:00:00.000Z'),
      [
        worklog({
          absence: AbsenceReason.holiday,
          from: new Date('2023-10-21T08:00:00.000Z'),
          to: new Date('2023-10-21T16:00:00.000Z'),
        }),
      ],
      [],
    );

    // Neither worked nor expected minutes accrue on the Saturday.
    expect(saldo.toString()).toBe('0h 0min');
  });

  // @scenario saldo/Negative saldo formatting
  it('formats a negative saldo with an error badge', () => {
    const saldo = minutesToSaldoObject(-45);

    expect(saldo.toString()).toBe('-0h 45min');
    const { container } = render(saldo.toBadge());
    expect(container.firstChild).toHaveClass('badge-error');
    expect(container.firstChild).toHaveTextContent('-0h 45min');
  });

  // @scenario saldo/Positive saldo formatting
  it('floors a positive saldo and renders a success badge', () => {
    const saldo = minutesToSaldoObject(125);

    expect(saldo.hours).toBe(2);
    expect(saldo.minutes).toBe(5);
    expect(saldo.toString()).toBe('2h 5min');
    const { container } = render(saldo.toBadge());
    expect(container.firstChild).toHaveClass('badge-success');
  });

  // Hours logged on a day that also carries an absence. No rule is special-cased
  // for the pair: each record contributes what its own rule says, and the day
  // charges its expectation once.
  const threeHoursOn = (day: string) =>
    worklog({
      from: new Date(`${day}T17:00:00.000Z`),
      to: new Date(`${day}T20:00:00.000Z`),
      subtractLunchBreak: false,
    });
  const absenceOn = (day: string, absence: AbsenceReason) =>
    worklog({
      absence,
      from: new Date(`${day}T08:00:00.000Z`),
      to: new Date(`${day}T16:00:00.000Z`),
      subtractLunchBreak: true,
    });

  // @scenario saldo/Work during a holiday raises the balance by the hours worked
  it('adds the hours worked during a holiday on top of a neutral day', () => {
    at('2023-10-16T22:00:00.000Z');

    // 450 credited by the holiday + 180 worked, against 450 expected.
    const saldo = calculateCurrentSaldo(
      settingsFor(MONDAY),
      [
        absenceOn('2023-10-16', AbsenceReason.holiday),
        threeHoursOn('2023-10-16'),
      ],
      [],
    );

    expect(saldo.toString()).toBe('3h 0min');
  });

  // @scenario saldo/Work during a flex day draws down only the unworked part
  it('offsets a flex day by the hours actually worked on it', () => {
    at('2023-10-16T22:00:00.000Z');

    // A flex day credits nothing, so the 180 worked reduce the 450 drawdown.
    const saldo = calculateCurrentSaldo(
      settingsFor(MONDAY),
      [
        absenceOn('2023-10-16', AbsenceReason.flex_hours),
        threeHoursOn('2023-10-16'),
      ],
      [],
    );

    expect(saldo.toString()).toBe('-4h 30min');
  });

  // @scenario saldo/Work on an absence day that is not a working day
  it('counts hours worked on an absence that falls on a Saturday', () => {
    const SATURDAY = '2023-10-14T00:00:00.000Z';
    at('2023-10-14T22:00:00.000Z');

    // The Saturday expects nothing and the absence credits nothing, so only
    // the worked hours remain.
    const saldo = calculateCurrentSaldo(
      settingsFor(SATURDAY),
      [
        absenceOn('2023-10-14', AbsenceReason.holiday),
        threeHoursOn('2023-10-14'),
      ],
      [],
    );

    expect(saldo.toString()).toBe('3h 0min');
  });
});

describe('absence conflict helpers', () => {
  const isoDay = (day: string) => day as Date_ISODay;

  describe('daysInRange', () => {
    it('returns the single day a one-day range covers', () => {
      expect(
        daysInRange(
          new Date('2026-07-28T08:00:00.000Z'),
          new Date('2026-07-28T08:00:00.000Z'),
        ),
      ).toEqual(['2026-07-28']);
    });

    it('returns every day of an inclusive multi-day range', () => {
      expect(
        daysInRange(
          new Date('2026-07-28T08:00:00.000Z'),
          new Date('2026-07-30T08:00:00.000Z'),
        ),
      ).toEqual(['2026-07-28', '2026-07-29', '2026-07-30']);
    });

    // The range's ends carry the user's default work hours, not boundaries: a
    // range ending at 08:00 must not be a day shorter than one ending at 16:00.
    it('ignores the times carried by either end', () => {
      const endsEarly = daysInRange(
        new Date('2026-07-28T16:00:00.000Z'),
        new Date('2026-07-29T08:00:00.000Z'),
      );
      const endsLate = daysInRange(
        new Date('2026-07-28T08:00:00.000Z'),
        new Date('2026-07-29T16:00:00.000Z'),
      );

      expect(endsEarly).toEqual(['2026-07-28', '2026-07-29']);
      expect(endsLate).toEqual(endsEarly);
    });

    it('returns nothing when the range runs backwards', () => {
      expect(
        daysInRange(
          new Date('2026-07-30T08:00:00.000Z'),
          new Date('2026-07-28T08:00:00.000Z'),
        ),
      ).toEqual([]);
    });
  });

  describe('absenceConflictMessage', () => {
    // @scenario absence/The message names the conflicting day
    it('names the day a single conflict falls on', () => {
      expect(absenceConflictMessage([isoDay('2026-07-28')])).toBe(
        'An absence is already recorded for 28.7.2026.',
      );
    });

    it('lists three conflicting days in full', () => {
      expect(
        absenceConflictMessage([
          isoDay('2026-07-28'),
          isoDay('2026-07-29'),
          isoDay('2026-07-30'),
        ]),
      ).toBe(
        'An absence is already recorded for 28.7.2026, 29.7.2026, 30.7.2026.',
      );
    });

    // @scenario absence/Many taken days are summarized
    it('names the first three and counts the rest', () => {
      expect(
        absenceConflictMessage([
          isoDay('2026-07-28'),
          isoDay('2026-07-29'),
          isoDay('2026-07-30'),
          isoDay('2026-07-31'),
          isoDay('2026-08-01'),
        ]),
      ).toBe(
        'An absence is already recorded for 28.7.2026, 29.7.2026, 30.7.2026 and 2 more days.',
      );
    });

    it('counts a single remaining day in the singular', () => {
      expect(
        absenceConflictMessage([
          isoDay('2026-07-28'),
          isoDay('2026-07-29'),
          isoDay('2026-07-30'),
          isoDay('2026-07-31'),
        ]),
      ).toContain('and 1 more day.');
    });

    it('stays a well-formed sentence when given no days', () => {
      expect(absenceConflictMessage([])).toBe(
        'An absence is already recorded for the selected days.',
      );
    });
  });
});

describe('worklog overlap helpers', () => {
  const at = (time: string) => new Date(`2026-06-28T${time}:00.000Z`);
  const span = (from: string, to: string) => ({ from: at(from), to: at(to) });

  describe('spansOverlap', () => {
    // @scenario worklog/Identical span is reported as a conflict
    it('treats identical spans as overlapping', () => {
      expect(spansOverlap(span('09:00', '17:00'), span('09:00', '17:00'))).toBe(
        true,
      );
    });

    // @scenario worklog/Partially overlapping span is reported as a conflict
    it('treats a partial overlap as overlapping, in both orders', () => {
      expect(spansOverlap(span('09:00', '17:00'), span('16:00', '18:00'))).toBe(
        true,
      );
      expect(spansOverlap(span('16:00', '18:00'), span('09:00', '17:00'))).toBe(
        true,
      );
    });

    it('treats a fully contained span as overlapping', () => {
      expect(spansOverlap(span('09:00', '17:00'), span('10:00', '11:00'))).toBe(
        true,
      );
    });

    // @scenario worklog/Touching spans are not a conflict
    it('does not treat back-to-back spans as overlapping', () => {
      expect(spansOverlap(span('08:00', '12:00'), span('12:00', '16:00'))).toBe(
        false,
      );
      expect(spansOverlap(span('12:00', '16:00'), span('08:00', '12:00'))).toBe(
        false,
      );
    });

    // @scenario worklog/Non-overlapping spans are not a conflict
    it('does not treat disjoint spans as overlapping', () => {
      expect(spansOverlap(span('08:00', '12:00'), span('13:00', '16:00'))).toBe(
        false,
      );
    });
  });

  describe('worklogOverlapMessage', () => {
    // @scenario worklog/The conflict names the entry it collides with
    it('names the day and times of a single conflict', () => {
      expect(worklogOverlapMessage([span('09:00', '17:00')])).toBe(
        'This overlaps 28.6.2026 09:00–17:00.',
      );
    });

    it('lists three conflicts in full', () => {
      expect(
        worklogOverlapMessage([
          span('08:00', '09:00'),
          span('10:00', '11:00'),
          span('12:00', '13:00'),
        ]),
      ).toBe(
        'This overlaps 28.6.2026 08:00–09:00, 28.6.2026 10:00–11:00, 28.6.2026 12:00–13:00.',
      );
    });

    it('names the first three and counts the rest', () => {
      expect(
        worklogOverlapMessage([
          span('08:00', '09:00'),
          span('10:00', '11:00'),
          span('12:00', '13:00'),
          span('14:00', '15:00'),
          span('16:00', '17:00'),
        ]),
      ).toContain('and 2 more entries.');
    });

    it('counts a single remaining entry in the singular', () => {
      expect(
        worklogOverlapMessage([
          span('08:00', '09:00'),
          span('10:00', '11:00'),
          span('12:00', '13:00'),
          span('14:00', '15:00'),
        ]),
      ).toContain('and 1 more entry.');
    });

    it('stays a well-formed sentence when given no spans', () => {
      expect(worklogOverlapMessage([])).toBe(
        'This overlaps hours you have already logged.',
      );
    });
  });
});
