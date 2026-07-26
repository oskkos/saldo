import { test, expect, type Page } from '@playwright/test';
import {
  disconnect,
  getOverrides,
  resetUserData,
  seedOverride,
  utcDay,
} from './db';

// The override form lives in the "Special days" collapse on /settings. The page
// renders three hh/mm pairs and two date inputs in total, so every field here is
// scoped to the panel rather than picked by index — the panel is the only place
// these particular controls are unambiguous.
const panel = (page: Page) =>
  page.locator('details:has(summary:has-text("Special days"))');

const openPanel = async (page: Page) => {
  await panel(page).locator('summary').click();
  await expect(addButton(page)).toBeVisible();
};

const dateField = (page: Page) => panel(page).locator('input[type="date"]');
const hoursField = (page: Page) =>
  panel(page).locator('input[placeholder="hh"]');
const minsField = (page: Page) =>
  panel(page).locator('input[placeholder="mm"]');
const labelField = (page: Page) =>
  panel(page).locator('input[placeholder="Label (optional)"]');
const addButton = (page: Page) =>
  panel(page).getByRole('button', { name: 'Add special day' });

// Date-agnostic like the rest of the suite: a day a month out, which is outside
// the accrual window and so cannot collide with today's own figures.
const OFFSET = 30;
const isoDay = (offsetDays: number) =>
  utcDay(offsetDays).toISOString().slice(0, 10);

test.beforeEach(async () => {
  await resetUserData();
});

test.afterAll(async () => {
  await disconnect();
});

// @scenario expected-hours/Create an override
test('an override added from the Special days panel is persisted', async ({
  page,
}) => {
  await page.goto('/settings');
  await openPanel(page);

  await dateField(page).fill(isoDay(OFFSET));
  await hoursField(page).fill('5');
  await minsField(page).fill('0');
  await labelField(page).fill('Short day');
  await addButton(page).click();

  await expect(page.getByText('Special day saved')).toBeVisible();

  const stored = await getOverrides();
  expect(stored).toHaveLength(1);
  expect(stored[0].date.toISOString().slice(0, 10)).toBe(isoDay(OFFSET));
  expect(stored[0].minutes).toBe(300);
  expect(stored[0].label).toBe('Short day');

  // And the saved day is listed back, so the panel reflects what was stored.
  await expect(panel(page).getByText('5h 0min')).toBeVisible();
});

// @scenario expected-hours/One override per date
test('saving a second value for the same date updates it rather than adding another', async ({
  page,
}) => {
  await seedOverride({
    date: utcDay(OFFSET),
    minutes: 300,
    label: 'First guess',
  });
  await page.goto('/settings');
  await openPanel(page);

  // Clicking the listed entry loads it back into the form to be edited.
  await panel(page)
    .getByRole('button', { name: /5h 0min/ })
    .click();
  await hoursField(page).fill('4');
  await minsField(page).fill('30');
  await addButton(page).click();

  await expect(page.getByText('Special day saved')).toBeVisible();

  const stored = await getOverrides();
  expect(stored).toHaveLength(1);
  expect(stored[0].minutes).toBe(270);
});

// No scenario claims deletion, but the requirement covers it and the delete path
// is its own server action, so the journey is worth closing here.
test('removing a special day deletes the override', async ({ page }) => {
  await seedOverride({ date: utcDay(OFFSET), minutes: 300 });
  await page.goto('/settings');
  await openPanel(page);

  // react-icons renders the label as an SVG <title> child, not an attribute.
  await panel(page)
    .locator('svg')
    .filter({ has: page.locator('title:text-is("Remove")') })
    .click();

  await expect(page.getByText('Special day removed')).toBeVisible();
  expect(await getOverrides()).toHaveLength(0);
});
