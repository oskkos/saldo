import { describe, it, expect, jest, beforeAll } from '@jest/globals';

// date-holidays is stubbed with a counting fake so the per-year memoization in
// util/date can be observed. The real classification is asserted separately in
// date.test.ts, which this must not contradict.
const yearsRequested: number[] = [];

jest.mock('date-holidays', () => ({
  __esModule: true,
  default: class {
    getHolidays(year: number) {
      yearsRequested.push(year);
      // One public holiday per year, on 1 January, plus a non-public entry
      // that must be filtered out.
      return [
        { date: `${year}-01-01 00:00:00`, type: 'public' },
        { date: `${year}-12-24 00:00:00`, type: 'observance' },
      ];
    }
  },
}));

let date: typeof import('@/util/date');

beforeAll(async () => {
  date = await import('@/util/date');
});

describe('holiday lookups over a long range', () => {
  // @scenario data-load-performance/Saldo accrual over a long date range
  it("computes each year's holidays once and reuses them for every day", () => {
    yearsRequested.length = 0;

    // Walk three years day by day, the way the saldo accrual does.
    let day = new Date(Date.UTC(2024, 0, 1));
    const end = new Date(Date.UTC(2026, 11, 31));
    let checks = 0;
    while (day.getTime() <= end.getTime()) {
      date.isNonWorkingDay(day);
      checks++;
      day = new Date(day.getTime() + 24 * 60 * 60 * 1000);
    }

    expect(checks).toBeGreaterThan(1000);
    // Three years walked, three computations — not one per day.
    expect([...new Set(yearsRequested)].sort()).toEqual([2024, 2025, 2026]);
    expect(yearsRequested).toHaveLength(3);
  });

  // @scenario data-load-performance/Saldo accrual over a long date range
  it('answers a repeated day without recomputing its year', () => {
    yearsRequested.length = 0;
    const day = new Date(Date.UTC(2024, 5, 10));

    date.isHoliday(day);
    date.isHoliday(day);
    date.isHoliday(new Date(Date.UTC(2024, 8, 3)));

    // The year was already warmed by the walk above, so nothing is recomputed.
    expect(yearsRequested).toHaveLength(0);
  });

  it('counts only public-type holidays', () => {
    expect(date.isHoliday(new Date(Date.UTC(2025, 0, 1)))).toBe(true);
    // The observance entry is filtered out.
    expect(date.isHoliday(new Date(Date.UTC(2025, 11, 24)))).toBe(false);
  });
});
