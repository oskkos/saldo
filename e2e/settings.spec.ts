import { test, expect, type Page } from '@playwright/test';
import {
  disconnect,
  getSettings,
  resetUserData,
  seedWorklog,
  utcTimeOn,
} from './db';

// Date-agnostic throughout: the saldo is asserted as a change, never as a
// figure, because the server's clock is not controllable from a test.

async function saldoMinutes(page: Page): Promise<number> {
  const text = await page.locator('.badge-lg').first().innerText();
  const match = /(-?)(\d+)h\s*(\d+)min/.exec(text);
  if (!match) throw new Error(`Unrecognized saldo badge text: "${text}"`);
  const magnitude = Number(match[2]) * 60 + Number(match[3]);
  return match[1] === '-' ? -magnitude : magnitude;
}

// The quick-add dialog lives in the layout, so its inputs exist on every page.
// Scope to what is actually on screen.
const visible = (page: Page, selector: string) =>
  page.locator(`${selector}:visible`);

// /settings renders three hh/mm pairs in this order: the initial balance, the
// default expected day, and the "special day" override form.
const hh = (page: Page, index: number) =>
  visible(page, 'input[placeholder="hh"]').nth(index);
const mm = (page: Page, index: number) =>
  visible(page, 'input[placeholder="mm"]').nth(index);

const balanceHours = (page: Page) => hh(page, 0);
const balanceMins = (page: Page) => mm(page, 0);
const expectedHours = (page: Page) => hh(page, 1);
const expectedMins = (page: Page) => mm(page, 1);
const fromDefault = (page: Page) => visible(page, 'input[placeholder="From"]');
const toDefault = (page: Page) => visible(page, 'input[placeholder="To"]');

const submit = (page: Page) =>
  page.getByRole('button', { name: 'Submit' }).click();

test.beforeEach(async () => {
  await resetUserData();
});

test.afterAll(async () => {
  await disconnect();
});

// @scenario settings/Save settings
// @scenario settings/Valid settings pass
// @scenario settings/Read own settings
test('saved settings persist and are read back on reload', async ({ page }) => {
  await page.goto('/settings');

  await balanceHours(page).fill('3');
  await balanceMins(page).fill('15');
  await fromDefault(page).fill('09:00');
  await toDefault(page).fill('17:00');
  await submit(page);
  await expect(page.getByText('Settings saved')).toBeVisible();

  const stored = await getSettings();
  expect(stored.initial_balance_hours).toBe(3);
  expect(stored.initial_balance_mins).toBe(15);
  expect(stored.from_default).toBe('09:00');
  expect(stored.to_default).toBe('17:00');

  // Reloading reads them back rather than showing the previous defaults.
  await page.reload();
  await expect(balanceHours(page)).toHaveValue('3');
  await expect(fromDefault(page)).toHaveValue('09:00');
});

// @scenario settings/Save settings
test('changing the expected day length moves the saldo', async ({ page }) => {
  // One full worked day against the default 7h30 expectation.
  await seedWorklog({ from: utcTimeOn(0, 8), to: utcTimeOn(0, 15, 30) });
  await page.goto('/');
  const before = await saldoMinutes(page);

  await page.goto('/settings');
  await expectedHours(page).fill('7');
  await expectedMins(page).fill('0');
  await submit(page);
  await expect(page.getByText('Settings saved')).toBeVisible();

  // Expecting 30 minutes less per day cannot lower the balance; for a window
  // containing at least today it rises. Asserted as a direction and a floor,
  // since how many working days the window holds depends on the real date.
  await page.goto('/');
  const after = await saldoMinutes(page);
  expect(after).toBeGreaterThanOrEqual(before + 30);
});

// @scenario settings/From after to is rejected
// @scenario settings/Inverted default times rejected
test('inverted default times are refused and change nothing', async ({
  page,
}) => {
  await page.goto('/settings');

  await fromDefault(page).fill('17:00');
  await toDefault(page).fill('09:00');
  await submit(page);

  await expect(page.getByRole('alert')).toBeVisible();
  const stored = await getSettings();
  expect(stored.from_default).toBe('08:00');
  expect(stored.to_default).toBe('16:00');
});

// @scenario settings/Seed on first sign-in
test('the signed-in user already has settings to edit', async ({ page }) => {
  // Settings are seeded when the account is provisioned, so the page renders
  // its stored values rather than an empty form.
  await page.goto('/settings');

  await expect(fromDefault(page)).toHaveValue('08:00');
  await expect(toDefault(page)).toHaveValue('16:00');
  await expect(expectedHours(page)).toHaveValue('7');
  await expect(expectedMins(page)).toHaveValue('30');
});
