import { test, expect, type Page } from './fixtures';
import {
  disconnect,
  pastSundayOffset,
  pastWorkingDayOffsets,
  resetUserData,
  seedOverride,
  seedWorklog,
  setSettings,
  utcDay,
  utcTimeOn,
} from './db';
import { saldoMinutes } from './ui';

// The saldo is a single running total, so nothing here asserts an absolute
// figure — the server's clock is not controllable and today's own expectation
// is already in the number before a test does anything. Every assertion is a
// delta: read the badge, change one thing, read it again.
//
// Two techniques recur. Seeding a worklog and re-reading isolates what that
// worklog contributed. And moving the begin date forward by one day drops
// exactly that day from the accrual window, so the difference between the two
// readings is everything the day contributed — worked minutes and expected
// minutes together. The second is what most of these scenarios are about: a
// plain before/after cannot see the expected side, because the day accrues its
// expectation whether or not anything is logged on it.

const home = (page: Page) => page.goto('/');

async function saldoAfter(page: Page): Promise<number> {
  await home(page);
  return saldoMinutes(page);
}

/** What one day adds to the balance: the window including it, minus the window without. */
async function dayContribution(page: Page, offset: number): Promise<number> {
  await setSettings({ begin_date: utcDay(offset) });
  const including = await saldoAfter(page);
  await setSettings({ begin_date: utcDay(offset + 1) });
  const excluding = await saldoAfter(page);
  return including - excluding;
}

test.beforeEach(async () => {
  await resetUserData();
});

test.afterAll(async () => {
  await disconnect();
});

// @scenario saldo/Non-zero initial balance
test('the initial balance is added to the running total', async ({ page }) => {
  const before = await saldoAfter(page);

  await setSettings({ initial_balance_hours: 2, initial_balance_mins: 30 });

  expect(await saldoAfter(page)).toBe(before + 150);
});

// @scenario saldo/Lunch break subtracted
// @scenario saldo/Lunch break not subtracted
test('worked minutes are net of the lunch break when it is set', async ({
  page,
}) => {
  const [first, second] = pastWorkingDayOffsets(2);
  const before = await saldoAfter(page);

  // 555 minutes on the clock, 30 of them lunch.
  await seedWorklog({
    from: utcTimeOn(first, 7),
    to: utcTimeOn(first, 16, 15),
    subtractLunchBreak: true,
  });
  const withLunch = await saldoAfter(page);
  expect(withLunch).toBe(before + 525);

  // 510 minutes on the clock, none of them deducted.
  await seedWorklog({
    from: utcTimeOn(second, 8),
    to: utcTimeOn(second, 16, 30),
    subtractLunchBreak: false,
  });
  expect(await saldoAfter(page)).toBe(withLunch + 510);
});

// @scenario saldo/Work logged on a Sunday counts
test('work logged on a Sunday still counts towards the balance', async ({
  page,
}) => {
  const sunday = pastSundayOffset();
  await seedWorklog({ from: utcTimeOn(sunday, 10), to: utcTimeOn(sunday, 12) });

  // A clean +120: the two hours are credited and the day expects nothing back.
  expect(await dayContribution(page, sunday)).toBe(120);
});

// @scenario saldo/Weekends and holidays do not raise the expectation
test('a weekend accrues no expected time while a working day accrues the default', async ({
  page,
}) => {
  expect(await dayContribution(page, pastSundayOffset())).toBe(0);

  const [workingDay] = pastWorkingDayOffsets(1);
  expect(await dayContribution(page, workingDay)).toBe(-450);
});

// @scenario saldo/A short day accrues its overridden expectation
// @scenario expected-hours/Override takes precedence over the weekend rule
test('an override replaces the expectation a day would otherwise have', async ({
  page,
}) => {
  const [workingDay] = pastWorkingDayOffsets(1);
  await seedOverride({ date: utcDay(workingDay), minutes: 300 });
  // -300, not the -450 the day would have expected by default.
  expect(await dayContribution(page, workingDay)).toBe(-300);

  const sunday = pastSundayOffset();
  await seedOverride({ date: utcDay(sunday), minutes: 300 });
  // -300, not the 0 the non-working-day rule would have given it.
  expect(await dayContribution(page, sunday)).toBe(-300);
});

// @scenario saldo/Entry the day before begin date
test('a worklog before the begin date contributes nothing', async ({
  page,
}) => {
  const [begin, dayBefore] = pastWorkingDayOffsets(2);
  await setSettings({ begin_date: utcDay(begin) });
  const before = await saldoAfter(page);

  await seedWorklog({
    from: utcTimeOn(dayBefore, 8),
    to: utcTimeOn(dayBefore, 16),
  });

  expect(await saldoAfter(page)).toBe(before);
});

// @scenario saldo/Entry dated tomorrow
test('a worklog dated tomorrow contributes nothing', async ({ page }) => {
  const before = await saldoAfter(page);

  await seedWorklog({ from: utcTimeOn(1, 8), to: utcTimeOn(1, 16) });

  expect(await saldoAfter(page)).toBe(before);
});

// @scenario saldo/Flex day on a working day
test('a flex-hours absence draws the balance down by a full day', async ({
  page,
}) => {
  const [workingDay] = pastWorkingDayOffsets(1);
  await seedWorklog({
    from: utcTimeOn(workingDay, 8),
    to: utcTimeOn(workingDay, 16),
    absence: 'flex_hours',
  });

  // No worked minutes credited, but the day still expects its 450.
  expect(await dayContribution(page, workingDay)).toBe(-450);
});

// @scenario saldo/Vacation on a working Friday
test('a non-flex absence on a working day is balance-neutral', async ({
  page,
}) => {
  const [workingDay] = pastWorkingDayOffsets(1);
  // Stored as a single hour on purpose: the credit is the day's expectation,
  // not the times on the record, so the day must still come out level.
  await seedWorklog({
    from: utcTimeOn(workingDay, 9),
    to: utcTimeOn(workingDay, 10),
    absence: 'holiday',
  });

  expect(await dayContribution(page, workingDay)).toBe(0);
});

// @scenario saldo/Vacation on a Saturday
test('an absence on a non-working day is ignored entirely', async ({
  page,
}) => {
  const sunday = pastSundayOffset();
  await seedWorklog({
    from: utcTimeOn(sunday, 8),
    to: utcTimeOn(sunday, 16),
    absence: 'holiday',
  });

  // Neither worked nor expected minutes: the day is left out of both sides.
  expect(await dayContribution(page, sunday)).toBe(0);
});

// @scenario saldo/Negative saldo formatting
// @scenario saldo/Positive saldo formatting
test('the badge is styled by the sign of the balance', async ({ page }) => {
  // Begin today, so the accrued expectation is at most one day and cannot flip
  // the sign of an initial balance this size.
  await setSettings({ begin_date: utcDay(0), initial_balance_hours: -100 });
  await home(page);
  const negative = page.locator('.badge-lg');
  await expect(negative).toHaveClass(/badge-error/);
  await expect(negative).toHaveText(/^-\d+h \d+min$/);

  await setSettings({ initial_balance_hours: 100 });
  await home(page);
  const positive = page.locator('.badge-lg');
  await expect(positive).toHaveClass(/badge-success/);
  await expect(positive).toHaveText(/^\d+h \d+min$/);
});

// @scenario saldo/Sum over a mixed list
test('the day total sums raw worklog times, absences included', async ({
  page,
}) => {
  const [day] = pastWorkingDayOffsets(1);
  const isoDay = utcDay(day).toISOString().slice(0, 10);

  await seedWorklog({ from: utcTimeOn(day, 8), to: utcTimeOn(day, 10) }); // 2h
  await seedWorklog({
    from: utcTimeOn(day, 10),
    to: utcTimeOn(day, 12),
    absence: 'holiday',
  }); // 2h, counted by its stored times
  await seedWorklog({
    from: utcTimeOn(day, 13),
    to: utcTimeOn(day, 14, 30),
    subtractLunchBreak: true,
  }); // 1h30 less a 30min lunch

  await page.goto(`/worklog-entry?day=${isoDay}`);

  // The day total is not the saldo: no absence special-casing, so 2 + 2 + 1.
  await expect(
    page.locator('h2:has-text("Existing worklogs for day") + div.badge'),
  ).toHaveText('5h 0min');
});

// @scenario saldo/Work during a holiday raises the balance by the hours worked
test('hours worked during a holiday raise the balance by those hours', async ({
  page,
}) => {
  const [workingDay] = pastWorkingDayOffsets(1);
  await seedWorklog({
    from: utcTimeOn(workingDay, 8),
    to: utcTimeOn(workingDay, 16),
    absence: 'holiday',
  });
  await seedWorklog({
    from: utcTimeOn(workingDay, 17),
    to: utcTimeOn(workingDay, 20),
  });

  // The holiday still settles the day to zero; the three hours worked on top
  // are what is left. No manual correction, and the absence is untouched.
  expect(await dayContribution(page, workingDay)).toBe(180);
});

// @scenario saldo/Work during a flex day draws down only the unworked part
test('hours worked on a flex day offset part of its drawdown', async ({
  page,
}) => {
  const [workingDay] = pastWorkingDayOffsets(1);
  await seedWorklog({
    from: utcTimeOn(workingDay, 8),
    to: utcTimeOn(workingDay, 16),
    absence: 'flex_hours',
  });
  await seedWorklog({
    from: utcTimeOn(workingDay, 17),
    to: utcTimeOn(workingDay, 20),
  });

  // A flex day credits nothing, so the day still expects 450; the 180 worked
  // reduce the drawdown rather than cancelling it.
  expect(await dayContribution(page, workingDay)).toBe(-270);
});

// @scenario saldo/Work on an absence day that is not a working day
test('hours worked on an absence that falls on a Sunday still count', async ({
  page,
}) => {
  const sunday = pastSundayOffset();
  await seedWorklog({
    from: utcTimeOn(sunday, 8),
    to: utcTimeOn(sunday, 16),
    absence: 'holiday',
  });
  await seedWorklog({ from: utcTimeOn(sunday, 17), to: utcTimeOn(sunday, 20) });

  // Nothing is expected and the absence credits nothing, so only the worked
  // hours remain.
  expect(await dayContribution(page, sunday)).toBe(180);
});
