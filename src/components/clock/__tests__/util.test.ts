import { describe, expect, test } from '@jest/globals';
import { crossesMidnight } from '../util';

describe('crossesMidnight', () => {
  test('false for a same-day session', () => {
    expect(
      crossesMidnight(
        new Date('2026-06-29T09:00:00.000Z'),
        new Date('2026-06-29T17:00:00.000Z'),
      ),
    ).toBe(false);
  });

  test('true when the end falls on a later UTC day', () => {
    expect(
      crossesMidnight(
        new Date('2026-06-29T23:30:00.000Z'),
        new Date('2026-06-30T01:00:00.000Z'),
      ),
    ).toBe(true);
  });

  test('uses UTC days, independent of the runtime timezone', () => {
    // Both instants are the same UTC day (2026-06-29) even though they are on
    // different local days in some timezones; must still be same-day.
    expect(
      crossesMidnight(
        new Date('2026-06-29T00:30:00.000Z'),
        new Date('2026-06-29T23:30:00.000Z'),
      ),
    ).toBe(false);
  });
});
