import { describe, expect, it } from '@jest/globals';
import { ExpectedHoursOverrideSchema } from '../expectedHoursOverrideSchema';

const base = {
  date: new Date('2026-12-23T00:00:00Z'),
  minutes: 300,
  label: 'Christmas Eve eve',
};

describe('ExpectedHoursOverrideSchema', () => {
  it('accepts a valid override', () => {
    expect(ExpectedHoursOverrideSchema.safeParse(base).success).toBe(true);
  });

  it('accepts an override with no label', () => {
    const { label: _label, ...noLabel } = base;
    void _label;
    expect(ExpectedHoursOverrideSchema.safeParse(noLabel).success).toBe(true);
  });

  it('rejects negative minutes', () => {
    expect(
      ExpectedHoursOverrideSchema.safeParse({ ...base, minutes: -1 }).success,
    ).toBe(false);
  });

  it('rejects minutes over 24h', () => {
    expect(
      ExpectedHoursOverrideSchema.safeParse({ ...base, minutes: 24 * 60 + 1 })
        .success,
    ).toBe(false);
  });

  it('rejects a non-integer minutes value', () => {
    expect(
      ExpectedHoursOverrideSchema.safeParse({ ...base, minutes: 90.5 }).success,
    ).toBe(false);
  });

  it('rejects a label longer than 100 characters', () => {
    expect(
      ExpectedHoursOverrideSchema.safeParse({ ...base, label: 'x'.repeat(101) })
        .success,
    ).toBe(false);
  });
});
