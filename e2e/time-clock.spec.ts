import { test, expect, type Page } from './fixtures';
import {
  resetClockState,
  setOpenSession,
  getStartedAt,
  getWorklogs,
  seedWorklog,
  utcTimeOn,
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

// Press Save on the finalize dialog and answer the overlap prompt it raises.
// The prompt is a native window.confirm, so it arrives as a Playwright dialog
// event; both it and the click are awaited together because the click does not
// settle until the dialog has been answered.
async function answerOverlapPrompt(page: Page, answer: 'accept' | 'dismiss') {
  const prompt = page.waitForEvent('dialog');
  const clicked = finalizeModal(page)
    .getByRole('button', { name: 'Save' })
    .click();
  const dialog = await prompt;
  expect(dialog.message()).toContain('Save anyway?');
  await (answer === 'accept' ? dialog.accept() : dialog.dismiss());
  await clicked;
}

test.beforeEach(async () => {
  await resetClockState();
});

test.afterAll(async () => {
  await disconnect();
});

// @scenario time-clock/Idle home screen
test('idle home screen shows a clock-in action', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Clock in' })).toBeVisible();
  await expect(page.getByTitle('Clocked in')).toHaveCount(0);
});

// @scenario time-clock/Clock in when idle
test('clock in when idle shows the clocked-in state', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-07-25T08:00:00Z') });
  await page.goto('/');

  await page.getByRole('button', { name: 'Clock in' }).click();

  await expect(page.getByRole('button', { name: 'Clock out' })).toBeVisible();
  await expect(page.getByText('Since 08:00')).toBeVisible();
  expect(await getStartedAt()).not.toBeNull();
});

// @scenario time-clock/Running state is globally visible
test('running state is visible across the app (badge + clock-out)', async ({
  page,
}) => {
  await page.clock.install({ time: new Date('2026-07-25T08:00:00Z') });
  await page.goto('/');
  await page.getByRole('button', { name: 'Clock in' }).click();
  await expect(page.getByRole('button', { name: 'Clock out' })).toBeVisible();
  // The home screen shows the running session's elapsed time.
  await expect(page.getByText('Since 08:00')).toBeVisible();

  // Navigate elsewhere: the always-visible badge (server-rendered in the navbar)
  // must indicate the clocked-in state from any page.
  await page.goto('/settings');
  await expect(page.getByTitle('Clocked in')).toBeVisible();
});

// @scenario time-clock/Returning with an open session
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

// @scenario time-clock/Save creates a worklog
// @scenario time-clock/Logged times match the clock
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

  // Choose a lunch-break setting and a comment, so the saved worklog is checked
  // against what the user picked rather than only against the defaults.
  await finalizeModal(page)
    .getByLabel('Subtract lunch break automatically')
    .uncheck();
  await finalizeModal(page).getByPlaceholder('Comment').fill('Feature work');

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
  expect(worklogs[0].subtract_lunch_break).toBe(false);
  expect(worklogs[0].comment).toBe('Feature work');
});

// @scenario time-clock/Cancel keeps the session open
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

// @scenario time-clock/Discard
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

// @scenario time-clock/Overnight session must be corrected or discarded
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

// @scenario time-clock/Declining the overlap keeps the session
// @scenario time-clock/Confirming the overlap finalizes normally
test('an overlapping session is put to the user, and declining keeps it open', async ({
  page,
}) => {
  await page.clock.install({ time: new Date('2026-07-25T08:00:00Z') });
  // Hours already logged across the session the user is about to finish.
  await seedWorklog({
    from: new Date('2026-07-25T09:00:00Z'),
    to: new Date('2026-07-25T17:00:00Z'),
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Clock in' }).click();

  await page.clock.setFixedTime(new Date('2026-07-25T16:00:00Z'));
  await page.getByRole('button', { name: 'Clock out' }).click();
  await expect(finalizeHeading(page)).toBeVisible();

  // Declined: nothing logged, and — the part that matters — still clocked in,
  // so the tracked session is not lost to a prompt the user said no to.
  //
  // Wait for the dialog rather than registering `page.once` and hoping. A
  // `once` handler that never fires stays registered, so the NEXT prompt is
  // handled twice — the stale handler first, then this test's, which fails with
  // "Cannot accept dialog which is already handled" several steps from the real
  // cause. Awaiting the event also asserts the prompt appeared at all, which is
  // the scenario under test.
  await answerOverlapPrompt(page, 'dismiss');

  await expect(page.getByRole('button', { name: 'Clock out' })).toBeVisible();
  expect(await getStartedAt()).not.toBeNull();
  expect(await getWorklogs()).toHaveLength(1);

  // Confirming finishes the session as normal.
  await answerOverlapPrompt(page, 'accept');

  await expect(page.getByRole('button', { name: 'Clock in' })).toBeVisible();
  expect(await getStartedAt()).toBeNull();
  expect(await getWorklogs()).toHaveLength(2);
});
