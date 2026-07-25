import { test as setup, expect } from '@playwright/test';
import { TEST_USER } from './db';
import { STORAGE_STATE } from './constants';

// Sign in once through the real Credentials form and persist the session so the
// chromium project can reuse it (no per-test login). This also lightly exercises
// the auth capability. The seeded user is created in global-setup.
setup('authenticate', async ({ page }) => {
  await page.goto('/signin');

  await page.getByPlaceholder(/^email$/i).fill(TEST_USER.email);
  await page.getByPlaceholder(/^password$/i).fill(TEST_USER.password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();

  // Credentials sign-in redirects to the home screen; the clock control there is
  // proof we have an authenticated session.
  await page.waitForURL('/');
  await expect(page.getByRole('button', { name: 'Clock in' })).toBeVisible();

  await page.context().storageState({ path: STORAGE_STATE });
});
