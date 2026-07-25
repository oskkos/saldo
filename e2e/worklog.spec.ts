import { test, expect, type Page } from '@playwright/test';
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

// Assertions here are deliberately date-agnostic: page.clock controls only the
// browser, while the begin-date window and future-entry exclusion are decided
// on the server against the real clock. So worklogs are seeded relative to
// today and the saldo is asserted as a change, never as an absolute figure.

const isoDay = (offsetDays = 0) =>
  utcDay(offsetDays).toISOString().slice(0, 10);

/** The saldo badge as signed minutes, e.g. "-0h 45min" -> -45. */
async function saldoMinutes(page: Page): Promise<number> {
  const text = await page.locator('.badge-lg').first().innerText();
  const match = /(-?)(\d+)h\s*(\d+)min/.exec(text);
  if (!match) throw new Error(`Unrecognized saldo badge text: "${text}"`);
  const magnitude = Number(match[2]) * 60 + Number(match[3]);
  return match[1] === '-' ? -magnitude : magnitude;
}

const entryPage = (page: Page, offsetDays = 0) =>
  page.goto(`/worklog-entry?day=${isoDay(offsetDays)}`);

// Both the inline form and the quick-add/edit dialogs render the same inputs,
// so every field is scoped to whichever copy is currently visible. Closed
// <dialog> content is hidden, which makes this unambiguous.
const visible = (page: Page, selector: string) =>
  page.locator(`${selector}:visible`);

const fillTimes = async (page: Page, from: string, to: string) => {
  await visible(page, 'input[placeholder="From"]').fill(from);
  await visible(page, 'input[placeholder="To"]').fill(to);
};

// The worklog list groups by month in accordions that start collapsed, so the
// entries are present but hidden until a month is opened.
const expandMonths = async (page: Page) => {
  const toggles = page.locator('.collapse > input[type="checkbox"]');
  for (let i = 0; i < (await toggles.count()); i++) {
    await toggles.nth(i).check();
  }
};

// The icon button that opens a dialog and the dialog's own confirm button share
// a name, so the confirm is always taken from the open dialog.
const dialogButton = (page: Page, name: string) =>
  page.locator('dialog[open]').getByRole('button', { name, exact: true });

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
