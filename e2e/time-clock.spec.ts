import { test, expect, type Page } from '@playwright/test';
import {
  resetClockState,
  setOpenSession,
  getStartedAt,
  getWorklogs,
  disconnect,
} from './db';

// Each scenario below maps to a requirement in openspec/specs/time-clock/spec.md.
// The clocked-in badge (navbar) carries title="Clocked in". The finalize step is
// the <dialog id="clock-out-modal">; scope its buttons to it because "Save",
// "Cancel" and "Discard" are generic labels shared by other modals in the app.

// The finalize dialog. Native <dialog> renders in the top layer without hiding
// the page behind it, so tests must assert on the dialog itself (its heading
// appearing/disappearing) rather than on background content.
const finalizeModal = (page: Page) => page.locator('#clock-out-modal');
const finalizeHeading = (page: Page) =>
  finalizeModal(page).getByRole('heading', { name: 'Finish work session' });

test.beforeEach(async () => {
  await resetClockState();
});

test.afterAll(async () => {
  await disconnect();
});

test('idle home screen shows a clock-in action', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Clock in' })).toBeVisible();
  await expect(page.getByTitle('Clocked in')).toHaveCount(0);
});

test('clock in when idle shows the clocked-in state', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-07-25T08:00:00Z') });
  await page.goto('/');

  await page.getByRole('button', { name: 'Clock in' }).click();

  await expect(page.getByRole('button', { name: 'Clock out' })).toBeVisible();
  await expect(page.getByText('Since 08:00')).toBeVisible();
  expect(await getStartedAt()).not.toBeNull();
});

test('running state is visible across the app (badge + clock-out)', async ({
  page,
}) => {
  await page.clock.install({ time: new Date('2026-07-25T08:00:00Z') });
  await page.goto('/');
  await page.getByRole('button', { name: 'Clock in' }).click();
  await expect(page.getByRole('button', { name: 'Clock out' })).toBeVisible();

  // Navigate elsewhere: the always-visible badge (server-rendered in the navbar)
  // must indicate the clocked-in state from any page.
  await page.goto('/settings');
  await expect(page.getByTitle('Clocked in')).toBeVisible();
});

test('returning with an open session shows the running state, unchanged', async ({
  page,
}) => {
  const startedAt = new Date('2026-07-25T08:00:00Z');
  await setOpenSession(startedAt);

  await page.goto('/');

  await expect(page.getByRole('button', { name: 'Clock out' })).toBeVisible();
  await expect(page.getByText('Since 08:00')).toBeVisible();
  await expect(page.getByTitle('Clocked in')).toBeVisible();
  // No background process altered the session.
  expect((await getStartedAt())?.getTime()).toBe(startedAt.getTime());
});

test('save creates a worklog spanning the session and clears it', async ({
  page,
}) => {
  await page.clock.install({ time: new Date('2026-07-25T08:00:00Z') });
  await page.goto('/');
  await page.getByRole('button', { name: 'Clock in' }).click();
  await expect(page.getByRole('button', { name: 'Clock out' })).toBeVisible();

  await page.clock.setFixedTime(new Date('2026-07-25T16:00:00Z'));
  await page.getByRole('button', { name: 'Clock out' }).click();

  await expect(finalizeHeading(page)).toBeVisible();
  await finalizeModal(page).getByRole('button', { name: 'Save' }).click();

  // Dialog closed and back to idle before asserting on the DB.
  await expect(finalizeHeading(page)).toBeHidden();
  await expect(page.getByRole('button', { name: 'Clock in' })).toBeVisible();
  expect(await getStartedAt()).toBeNull();

  // The worklog reads 08:00–16:00 even though the server runs in a non-UTC zone.
  const worklogs = await getWorklogs();
  expect(worklogs).toHaveLength(1);
  expect(worklogs[0].from.getUTCHours()).toBe(8);
  expect(worklogs[0].to.getUTCHours()).toBe(16);
});

test('cancel keeps the session open and logs nothing', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-07-25T08:00:00Z') });
  await page.goto('/');
  await page.getByRole('button', { name: 'Clock in' }).click();

  await page.clock.setFixedTime(new Date('2026-07-25T16:00:00Z'));
  await page.getByRole('button', { name: 'Clock out' }).click();
  await expect(finalizeHeading(page)).toBeVisible();

  await finalizeModal(page)
    .getByRole('button', { name: 'Cancel', exact: true })
    .click();

  // Cancel closed the dialog and started no save; still clocked in, nothing logged.
  await expect(finalizeHeading(page)).toBeHidden();
  await expect(page.getByRole('button', { name: 'Clock out' })).toBeVisible();
  expect(await getStartedAt()).not.toBeNull();
  expect(await getWorklogs()).toHaveLength(0);
});

test('discard clears the session without logging', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-07-25T08:00:00Z') });
  await page.goto('/');
  await page.getByRole('button', { name: 'Clock in' }).click();

  await page.clock.setFixedTime(new Date('2026-07-25T16:00:00Z'));
  await page.getByRole('button', { name: 'Clock out' }).click();
  await expect(finalizeHeading(page)).toBeVisible();

  // The discard confirmation is a window.confirm.
  page.once('dialog', (dialog) => dialog.accept());
  await finalizeModal(page).getByRole('button', { name: 'Discard' }).click();

  await expect(finalizeHeading(page)).toBeHidden();
  await expect(page.getByRole('button', { name: 'Clock in' })).toBeVisible();
  expect(await getStartedAt()).toBeNull();
  expect(await getWorklogs()).toHaveLength(0);
});

test('overnight session must be corrected or discarded before saving', async ({
  page,
}) => {
  await page.clock.install({ time: new Date('2026-07-25T23:30:00Z') });
  await page.goto('/');
  await page.getByRole('button', { name: 'Clock in' }).click();
  await expect(page.getByRole('button', { name: 'Clock out' })).toBeVisible();

  // The session now crosses midnight.
  await page.clock.setFixedTime(new Date('2026-07-26T00:30:00Z'));
  await page.getByRole('button', { name: 'Clock out' }).click();

  await expect(
    finalizeModal(page).getByText(/crossed midnight/i),
  ).toBeVisible();
  // Save is blocked until a same-day end time is entered.
  await expect(
    finalizeModal(page).getByRole('button', { name: 'Save' }),
  ).toBeDisabled();

  // The user may instead discard.
  page.once('dialog', (dialog) => dialog.accept());
  await finalizeModal(page).getByRole('button', { name: 'Discard' }).click();
  await expect(finalizeHeading(page)).toBeHidden();
  await expect(page.getByRole('button', { name: 'Clock in' })).toBeVisible();
  expect(await getStartedAt()).toBeNull();
  expect(await getWorklogs()).toHaveLength(0);
});
