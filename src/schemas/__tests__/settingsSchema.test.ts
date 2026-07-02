import { describe, expect, it } from '@jest/globals';
import { SettingsSchema } from '../settingsSchema';

const base = {
  beginDate: new Date('2026-06-28T00:00:00Z'),
  initialBalanceHours: 2,
  initialBalanceMins: 30,
  fromDefault: '08:00',
  toDefault: '16:00',
  expectedMinutesPerDay: 450,
};

describe('SettingsSchema', () => {
  it('accepts valid settings', () => {
    expect(SettingsSchema.safeParse(base).success).toBe(true);
  });

  it('allows a negative initial balance (starting in deficit)', () => {
    expect(
      SettingsSchema.safeParse({ ...base, initialBalanceHours: -5 }).success,
    ).toBe(true);
  });

  it('rejects inverted default times (from after to)', () => {
    const result = SettingsSchema.safeParse({
      ...base,
      fromDefault: '16:00',
      toDefault: '08:00',
    });
    expect(result.success).toBe(false);
  });

  it('rejects equal default times', () => {
    const result = SettingsSchema.safeParse({
      ...base,
      fromDefault: '08:00',
      toDefault: '08:00',
    });
    expect(result.success).toBe(false);
  });

  it('rejects minutes outside 0-59', () => {
    expect(
      SettingsSchema.safeParse({ ...base, initialBalanceMins: 60 }).success,
    ).toBe(false);
  });

  it('rejects an invalid time format', () => {
    const result = SettingsSchema.safeParse({ ...base, fromDefault: '8am' });
    expect(result.success).toBe(false);
  });

  it('rejects a missing begin date', () => {
    const result = SettingsSchema.safeParse({ ...base, beginDate: undefined });
    expect(result.success).toBe(false);
  });
});
