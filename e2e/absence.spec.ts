import { test, expect, type Page } from './fixtures';
import {
  disconnect,
  getWorklogs,
  pastWorkingDayOffsets,
  resetUserData,
  seedWorklog,
  utcDay,
  utcTimeOn,
} from './db';
import { expandMonths, visible } from './ui';

// Date-agnostic throughout: ranges are chosen relative to today and asserted by
// the days they produce, never against a fixed calendar.

const isoDay = (offsetDays = 0) =>
  utcDay(offsetDays).toISOString().slice(0, 10);

// The conflict message names days the way the rest of the UI does (D.M.YYYY),
// built here from the same offset the test seeded rather than hard-coded.
const shownDay = (offsetDays = 0) => {
  const day = utcDay(offsetDays);
  return `${day.getUTCDate()}.${day.getUTCMonth() + 1}.${day.getUTCFullYear()}`;
};

const fromDate = (page: Page) => visible(page, 'input[type="date"]').nth(0);
const toDate = (page: Page) => visible(page, 'input[type="date"]').nth(1);
const reason = (page: Page) => visible(page, 'select');
const comment = (page: Page) =>
  visible(page, 'textarea[placeholder="Comment"]');

// react-icons renders the label as an SVG <title> child rather than an
// attribute, so the icon is found through the title it contains.
const reasonIcon = (page: Page, label: string) =>
  page
    .locator('svg')
    .filter({ has: page.locator(`title:text-is("${label}")`) });

test.beforeEach(async () => {
  await resetUserData();
});

test.afterAll(async () => {
  await disconnect();
});

// @scenario absence/Three-day absence
test('a multi-day range creates one absence per day', async ({ page }) => {
  await page.goto('/absence');

  await fromDate(page).fill(isoDay(0));
  await toDate(page).fill(isoDay(2));
  await reason(page).selectOption('sick_leave');
  await comment(page).fill('down with flu');
  await page.getByRole('button', { name: 'Submit' }).click();

  await expect(page.getByText('Absence added')).toBeVisible();

  const worklogs = await getWorklogs();
  expect(worklogs).toHaveLength(3);
  // One record per day of the inclusive range, all carrying the same choices.
  expect(worklogs.map((w) => w.from.toISOString().slice(0, 10))).toEqual([
    isoDay(0),
    isoDay(1),
    isoDay(2),
  ]);
  for (const worklog of worklogs) {
    expect(worklog.absence).toBe('sick_leave');
    expect(worklog.comment).toBe('down with flu');
  }
});

// @scenario absence/Reason selection
test('the reason picker offers exactly the four supported reasons', async ({
  page,
}) => {
  await page.goto('/absence');

  const options = reason(page).locator('option:not([disabled])');
  await expect(options).toHaveText([
    'Holiday',
    'Flex hours',
    'Sick leave',
    'Other',
  ]);
});

// @scenario absence/Range normalization
test('the range stays coherent when the dates cross, in both directions', async ({
  page,
}) => {
  await page.goto('/absence');

  // Pushing the from-date past the to-date drags the to-date along.
  //
  // This is the first interaction on the page, so it can land before React has
  // hydrated, in which case the DOM value changes but no handler runs. Each
  // retry therefore moves the field twice: refilling the value it already holds
  // would be a no-op, and the test could never recover.
  await expect(async () => {
    await fromDate(page).fill(isoDay(0));
    await fromDate(page).fill(isoDay(5));
    await expect(toDate(page)).toHaveValue(isoDay(5), { timeout: 1000 });
  }).toPass();

  // And pulling the to-date back before the from-date drags the from-date back.
  await toDate(page).fill(isoDay(1));
  await expect(fromDate(page)).toHaveValue(isoDay(1));
});

// @scenario absence/Icon per reason
// @scenario absence/Label formatting
test('an absence is listed by its readable label and its own icon', async ({
  page,
}) => {
  await seedWorklog({
    from: utcTimeOn(0, 8),
    to: utcTimeOn(0, 16),
    absence: 'flex_hours',
  });
  await seedWorklog({
    from: utcTimeOn(-1, 8),
    to: utcTimeOn(-1, 16),
    absence: 'sick_leave',
  });

  await page.goto('/worklog-items');
  await expandMonths(page);

  // Codes are rendered as labels, not as the stored underscored values.
  await expect(page.getByRole('heading', { name: 'Flex hours' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Sick leave' })).toBeVisible();
  await expect(page.getByText('flex_hours')).toBeHidden();

  // Each reason brings its own icon, so the two entries are distinguishable at
  // a glance rather than only by their text.
  await expect(reasonIcon(page, 'Flex hours')).toBeVisible();
  await expect(reasonIcon(page, 'Sick leave')).toBeVisible();
});

// @scenario absence/Second absence with the same reason is rejected
// @scenario absence/The message names the conflicting day
test('a day that already has an absence refuses a second one', async ({
  page,
}) => {
  await seedWorklog({
    from: utcTimeOn(0, 8),
    to: utcTimeOn(0, 16),
    absence: 'holiday',
  });

  await page.goto('/absence');
  await fromDate(page).fill(isoDay(0));
  await toDate(page).fill(isoDay(0));
  await reason(page).selectOption('holiday');
  await page.getByRole('button', { name: 'Submit' }).click();

  await expect(page.getByText('Failed to add absence')).toBeVisible();
  await expect(
    page.getByText(`An absence is already recorded for ${shownDay(0)}.`),
  ).toBeVisible();
  // The day the user picked is still held by the one absence it started with.
  expect(await getWorklogs()).toHaveLength(1);
});

// @scenario absence/One taken day rejects the whole range
test('one taken day inside a range rejects every day of it', async ({
  page,
}) => {
  await seedWorklog({
    from: utcTimeOn(1, 8),
    to: utcTimeOn(1, 16),
    absence: 'sick_leave',
  });

  await page.goto('/absence');
  await fromDate(page).fill(isoDay(0));
  await toDate(page).fill(isoDay(2));
  await reason(page).selectOption('holiday');
  await page.getByRole('button', { name: 'Submit' }).click();

  await expect(
    page.getByText(`An absence is already recorded for ${shownDay(1)}.`),
  ).toBeVisible();
  // Not one of the three days was written, not even the two that were free.
  const worklogs = await getWorklogs();
  expect(worklogs).toHaveLength(1);
  expect(worklogs[0].absence).toBe('sick_leave');
});

// @scenario absence/Hours worked on an absence day stay visible
test('the calendar shows an absence day with the hours worked on it', async ({
  page,
}) => {
  const [day] = pastWorkingDayOffsets(1);
  await seedWorklog({
    from: utcTimeOn(day, 8),
    to: utcTimeOn(day, 16),
    absence: 'holiday',
  });
  await seedWorklog({ from: utcTimeOn(day, 17), to: utcTimeOn(day, 20) });

  await page.goto('/');

  // Both, not one instead of the other. The figure counts only the three hours
  // logged: the absence's own 08:00-16:00 would otherwise read as 10.5h.
  await expect(reasonIcon(page, 'Holiday')).toBeVisible();
  await expect(page.getByText('3h', { exact: true })).toBeVisible();
  await expect(page.getByText('10.5h', { exact: true })).toBeHidden();
});
