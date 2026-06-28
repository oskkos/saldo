import { describe, expect, it } from '@jest/globals';
import { WorklogSchema } from '../worklogSchema';

const base = {
  from: new Date('2026-06-28T08:00:00Z'),
  to: new Date('2026-06-28T16:00:00Z'),
  comment: 'worked',
  subtractLunchBreak: true,
};

describe('WorklogSchema', () => {
  it('accepts a valid same-day worklog', () => {
    expect(WorklogSchema.safeParse(base).success).toBe(true);
  });

  it('accepts a valid worklog with a recognized absence reason', () => {
    expect(
      WorklogSchema.safeParse({ ...base, absence: 'holiday' }).success,
    ).toBe(true);
  });

  it('rejects zero-duration (to equals from)', () => {
    const result = WorklogSchema.safeParse({ ...base, to: base.from });
    expect(result.success).toBe(false);
  });

  it('rejects negative duration (to before from)', () => {
    const result = WorklogSchema.safeParse({
      ...base,
      from: new Date('2026-06-28T16:00:00Z'),
      to: new Date('2026-06-28T08:00:00Z'),
    });
    expect(result.success).toBe(false);
  });

  it('rejects a span across different calendar days', () => {
    const result = WorklogSchema.safeParse({
      ...base,
      from: new Date('2026-06-28T23:00:00Z'),
      to: new Date('2026-06-29T01:00:00Z'),
    });
    expect(result.success).toBe(false);
  });

  it('rejects an unrecognized absence reason', () => {
    const result = WorklogSchema.safeParse({ ...base, absence: 'vacation' });
    expect(result.success).toBe(false);
  });

  it('rejects a comment longer than 1000 characters', () => {
    const result = WorklogSchema.safeParse({
      ...base,
      comment: 'x'.repeat(1001),
    });
    expect(result.success).toBe(false);
  });
});
