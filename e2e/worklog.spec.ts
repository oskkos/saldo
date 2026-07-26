import { test, expect, type Page } from './fixtures';
import {
  clearOtherUserWorklogs,
  disconnect,
  getWorklogs,
  resetUserData,
  seedOtherUserWorklog,
  seedWorklog,
  utcDay,
  utcTimeOn,
} from './db';
import { dialogButton, expandMonths, saldoMinutes, visible } from './ui';

const isoDay = (offsetDays = 0) =>
  utcDay(offsetDays).toISOString().slice(0, 10);

const entryPage = (page: Page, offsetDays = 0) =>
  page.goto(`/worklog-entry?day=${isoDay(offsetDays)}`);

const fillTimes = async (page: Page, from: string, to: string) => {
  await visible(page, 'input[placeholder="From"]').fill(from);
  await visible(page, 'input[placeholder="To"]').fill(to);
};

const lunchToggle = (page: Page) =>
  page.locator(
    'label:has-text("Subtract lunch break automatically") input:visible',
  );

test.beforeEach(async () => {
  await resetUserData();
  await clearOtherUserWorklogs();
});

test.afterAll(async () => {
  await clearOtherUserWorklogs();
  await disconnect();
});

// @scenario worklog/Regular entry
// @scenario worklog/Valid worklog passes
// @scenario worklog/Client triggers a write
test('creating a worklog persists it and moves the saldo', async ({ page }) => {
  await entryPage(page);
  const before = await saldoMinutes(page);

  await fillTimes(page, '09:00', '12:00');
  await lunchToggle(page).uncheck();
  await page.getByRole('button', { name: 'Submit' }).click();

  // The entry appears without a reload, and the row really landed.
  await expect(page.getByText('09:00 - 12:00')).toBeVisible();
  const worklogs = await getWorklogs();
  expect(worklogs).toHaveLength(1);
  expect(worklogs[0].subtract_lunch_break).toBe(false);

  // Three worked hours against an unchanged expectation: the balance rises by
  // exactly 180 minutes, whatever it happened to be beforehand.
  await page.goto('/');
  expect(await saldoMinutes(page)).toBe(before + 180);
});

// @scenario worklog/Owner edits
test('editing a worklog updates it in place', async ({ page }) => {
  await seedWorklog({ from: utcTimeOn(0, 9), to: utcTimeOn(0, 12) });

  await page.goto('/worklog-items');
  await expandMonths(page);
  await expect(page.getByText('09:00 - 12:00')).toBeVisible();
  await page.getByRole('button', { name: 'Edit' }).first().click();

  await fillTimes(page, '09:00', '14:00');
  await dialogButton(page, 'Edit').click();

  await expect(page.getByText('09:00 - 14:00')).toBeVisible();
  const worklogs = await getWorklogs();
  expect(worklogs).toHaveLength(1);
  expect(worklogs[0].to.getUTCHours()).toBe(14);
});

// @scenario worklog/Owner deletes
test('deleting a worklog removes it', async ({ page }) => {
  await seedWorklog({ from: utcTimeOn(0, 9), to: utcTimeOn(0, 12) });

  await page.goto('/worklog-items');
  await expandMonths(page);
  await expect(page.getByText('09:00 - 12:00')).toBeVisible();
  await page.getByRole('button', { name: 'Delete' }).first().click();
  await dialogButton(page, 'Delete').click();

  await expect(page.getByText('09:00 - 12:00')).toBeHidden();
  expect(await getWorklogs()).toHaveLength(0);
});

// @scenario worklog/Range query
test('the entry page lists only the worklogs of the day it shows', async ({
  page,
}) => {
  await seedWorklog({ from: utcTimeOn(0, 9), to: utcTimeOn(0, 12) });
  await seedWorklog({ from: utcTimeOn(-1, 13), to: utcTimeOn(-1, 15) });

  await entryPage(page, 0);

  await expect(page.getByText('09:00 - 12:00')).toBeVisible();
  await expect(page.getByText('13:00 - 15:00')).toBeHidden();
});

// @scenario worklog/Unbounded query
test('the worklog list shows entries from every day', async ({ page }) => {
  await seedWorklog({ from: utcTimeOn(0, 9), to: utcTimeOn(0, 12) });
  await seedWorklog({ from: utcTimeOn(-1, 13), to: utcTimeOn(-1, 15) });

  await page.goto('/worklog-items');
  await expandMonths(page);

  await expect(page.getByText('09:00 - 12:00')).toBeVisible();
  await expect(page.getByText('13:00 - 15:00')).toBeVisible();
});

// @scenario worklog/Listing returns only own worklogs
test('the worklog list shows nothing belonging to another user', async ({
  page,
}) => {
  await seedWorklog({ from: utcTimeOn(0, 9), to: utcTimeOn(0, 12) });
  await seedOtherUserWorklog({
    from: utcTimeOn(0, 17),
    to: utcTimeOn(0, 19),
    comment: 'someone else',
  });

  await page.goto('/worklog-items');
  await expandMonths(page);

  await expect(page.getByText('09:00 - 12:00')).toBeVisible();
  await expect(page.getByText('17:00 - 19:00')).toBeHidden();
  await expect(page.getByText('someone else')).toBeHidden();
});

// @scenario worklog/New entry from duration uses the default start
// @scenario worklog/Duration is net worked time, not span
test('duration mode anchors at the default start and stores net time', async ({
  page,
}) => {
  await entryPage(page);

  // Defaults are 08:00-16:00 with the lunch break subtracted: net 7h 30min.
  await visible(page, 'input[aria-label="Enter as duration"]').check();
  await expect(visible(page, 'input[placeholder="Hours"]')).toHaveValue('7');
  await expect(visible(page, 'input[placeholder="Minutes"]')).toHaveValue('30');

  await page.getByRole('button', { name: 'Submit' }).click();

  // Wait for the entry to land in the list before reading the database, so the
  // assertion is not racing the server action.
  await expect(page.getByText('08:00 - 15:30')).toBeVisible();

  const worklogs = await getWorklogs();
  expect(worklogs).toHaveLength(1);
  // Net time anchored at the default start, with the lunch flag folded away.
  expect(worklogs[0].from.getUTCHours()).toBe(8);
  expect(worklogs[0].to.getUTCHours()).toBe(15);
  expect(worklogs[0].to.getUTCMinutes()).toBe(30);
  expect(worklogs[0].subtract_lunch_break).toBe(false);
});

// @scenario absence/Hours are saved on an absence day
// @scenario absence/The absence is not altered
// @scenario absence/The save is confirmed
// @scenario absence/Notice on an absence day
test('a day with an absence still takes hours, and keeps the absence', async ({
  page,
}) => {
  await seedWorklog({
    from: utcTimeOn(0, 8),
    to: utcTimeOn(0, 16),
    comment: 'Annual leave',
    absence: 'holiday',
  });

  await entryPage(page);
  await expect(
    page.getByText(
      'An absence is recorded for this day. Hours you log here are still added to your saldo.',
    ),
  ).toBeVisible();

  await fillTimes(page, '17:00', '20:00');
  await lunchToggle(page).uncheck();
  await page.getByRole('button', { name: 'Submit' }).click();

  await expect(page.getByText('Worklog created')).toBeVisible();
  await expect(page.getByText('17:00 - 20:00')).toBeVisible();
  // The absence is still there, untouched: same reason, same times, same
  // comment, and still exactly one of it.
  await expect(page.getByRole('heading', { name: 'Holiday' })).toBeVisible();
  const worklogs = await getWorklogs();
  expect(worklogs).toHaveLength(2);
  const absence = worklogs.find((w) => w.absence);
  expect(absence?.absence).toBe('holiday');
  expect(absence?.comment).toBe('Annual leave');
  expect(absence?.from.getUTCHours()).toBe(8);
  expect(absence?.to.getUTCHours()).toBe(16);
});
