import { test, expect } from './fixtures';
import { disconnect, resetUserData, seedWorklog, utcTimeOn } from './db';

// The span rule is a database CHECK constraint
// (`Worklog_work_entry_span_positive_and_bounded`, added in
// migrations/20260815130500_constrain_worklog_span), so it can only be exercised
// where a real database is. The unit layer mocks Prisma and would assert nothing.
//
// These write through Prisma directly rather than through the UI on purpose: the
// requirement is about what may be *stored*, including by a path that never passes
// through the form validation. That is the case the constraint exists for.

test.beforeEach(async () => {
  await resetUserData();
});

test.afterAll(async () => {
  await disconnect();
});

// @scenario worklog/A zero-length entry is rejected
test('a work entry ending exactly when it starts is rejected', async () => {
  await expect(
    seedWorklog({
      from: utcTimeOn(-1, 12, 44),
      to: utcTimeOn(-1, 12, 44),
    }),
  ).rejects.toThrow();
});

// @scenario worklog/An inverted entry is rejected
test('a work entry ending before it starts is rejected', async () => {
  await expect(
    seedWorklog({
      from: utcTimeOn(-1, 16),
      to: utcTimeOn(-1, 8),
    }),
  ).rejects.toThrow();
});

// @scenario worklog/An over-long entry is rejected
test('a work entry spanning more than a day is rejected', async () => {
  await expect(
    seedWorklog({
      from: utcTimeOn(-5, 8),
      to: utcTimeOn(-1, 16),
    }),
  ).rejects.toThrow();
});

// @scenario worklog/An ordinary entry is unaffected
test('an ordinary working day is stored unchanged', async () => {
  const stored = await seedWorklog({
    from: utcTimeOn(-1, 8),
    to: utcTimeOn(-1, 16),
  });

  expect(stored.from).toEqual(utcTimeOn(-1, 8));
  expect(stored.to).toEqual(utcTimeOn(-1, 16));
});

// An absence is exempt on both sides of the rule: the overlap read filters
// absences out, so they take no part in the guarantee the constraint supports.
// @scenario worklog/An absence is not subject to the span rule
test('an absence is stored even with a span the rule would reject', async () => {
  const stored = await seedWorklog({
    from: utcTimeOn(-1, 16),
    to: utcTimeOn(-1, 8),
    absence: 'holiday',
  });

  expect(stored.absence).toBe('holiday');
});
