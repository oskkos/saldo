// Locators shared across the e2e suites.
//
// Every assertion in this suite is date-agnostic: page.clock controls only the
// browser, while the begin-date window and the future-entry exclusion are
// decided on the server against the real clock. So state is seeded relative to
// today and the saldo is asserted as a change, never as an absolute figure.
import { type Page } from '@playwright/test';

// Both the inline forms and the quick-add/edit dialogs render the same inputs,
// so every field is scoped to whichever copy is currently on screen. A closed
// <dialog> hides its content, which makes this unambiguous.
export const visible = (page: Page, selector: string) =>
  page.locator(`${selector}:visible`);

/** The saldo badge as signed minutes, e.g. "-0h 45min" -> -45. */
export async function saldoMinutes(page: Page): Promise<number> {
  const text = await page.locator('.badge-lg').first().innerText();
  const match = /(-?)(\d+)h\s*(\d+)min/.exec(text);
  if (!match) throw new Error(`Unrecognized saldo badge text: "${text}"`);
  const magnitude = Number(match[2]) * 60 + Number(match[3]);
  return match[1] === '-' ? -magnitude : magnitude;
}

// The worklog list groups by month in accordions that start collapsed, so the
// entries are present but hidden until a month is opened.
export const expandMonths = async (page: Page) => {
  const toggles = page.locator('.collapse > input[type="checkbox"]');
  for (let i = 0; i < (await toggles.count()); i++) {
    await toggles.nth(i).check();
  }
};

// The icon button that opens a dialog and the dialog's own confirm button share
// a name, so the confirm is always taken from the open dialog.
export const dialogButton = (page: Page, name: string) =>
  page.locator('dialog[open]').getByRole('button', { name, exact: true });
