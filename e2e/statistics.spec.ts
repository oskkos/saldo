import { test, expect, type Page } from './fixtures';
import {
  deleteSettings,
  disconnect,
  pastNonWorkingDayOffset,
  pastWorkingDayOffsets,
  resetUserData,
  seedWorklog,
  setSettings,
  utcDay,
  utcTimeOn,
} from './db';

// Date-agnostic throughout: everything is seeded relative to today, and the
// dates that appear on screen are derived from the same offsets rather than
// written out. Weekday-sensitive setup asks db.ts for real working days,
// because the suite runs on whatever day CI happens to pick.

const dayMonthYear = (offsetDays: number) => {
  const day = utcDay(offsetDays);
  return `${day.getUTCDate()}.${day.getUTCMonth() + 1}.${day.getUTCFullYear()}`;
};

// The page lays the figures out as a two-column grid of sibling spans, so each
// value is the span following its label.
const figure = (page: Page, label: string) =>
  page.locator(`span:text-is("${label}") + span`);

test.beforeEach(async () => {
  await resetUserData();
  // Well before every offset these tests seed, so the window is not what
  // decides whether an entry counts — except where a test says otherwise.
  await setSettings({ begin_date: utcDay(-30) });
});

test.afterAll(async () => {
  await disconnect();
});

// @scenario statistics/Totals and extremes
// @scenario statistics/Out-of-window entries excluded
test('the hours figures are computed from the in-window work entries', async ({
  page,
}) => {
  await seedWorklog({ from: utcTimeOn(-3, 8), to: utcTimeOn(-3, 12) }); // 4h
  await seedWorklog({ from: utcTimeOn(-2, 8), to: utcTimeOn(-2, 14) }); // 6h
  // One before the begin date and one in the future: both outside the window.
  await seedWorklog({ from: utcTimeOn(-40, 8), to: utcTimeOn(-40, 16) });
  await seedWorklog({ from: utcTimeOn(3, 8), to: utcTimeOn(3, 16) });

  await page.goto('/statistics');

  // 10h over two logged days — the out-of-window entries would have added 16h
  // and dragged both extremes with them.
  await expect(figure(page, 'Total hours logged')).toHaveText('10h 0min');
  await expect(figure(page, 'Avg hours per day')).toHaveText('5h 0min');
  await expect(figure(page, 'Most hours per day')).toHaveText(
    `6h 0min on ${dayMonthYear(-2)}`,
  );
  await expect(figure(page, 'Least hours per day')).toHaveText(
    `4h 0min on ${dayMonthYear(-3)}`,
  );
});

// @scenario statistics/Absences excluded from hours totals
// @scenario statistics/Absence tally
test('absences stay out of the hours totals but are counted by reason', async ({
  page,
}) => {
  const [workingA, workingB] = pastWorkingDayOffsets(2);
  const nonWorking = pastNonWorkingDayOffset();

  await seedWorklog({ from: utcTimeOn(-3, 8), to: utcTimeOn(-3, 12) }); // 4h
  await seedWorklog({
    from: utcTimeOn(workingA, 8),
    to: utcTimeOn(workingA, 16),
    absence: 'holiday',
  });
  await seedWorklog({
    from: utcTimeOn(workingB, 8),
    to: utcTimeOn(workingB, 16),
    absence: 'holiday',
  });
  // On a weekend or public holiday, so it is not part of the tally.
  await seedWorklog({
    from: utcTimeOn(nonWorking, 8),
    to: utcTimeOn(nonWorking, 16),
    absence: 'sick_leave',
  });

  await page.goto('/statistics');

  // Only the work entry contributes; the three absences would have added 24h.
  await expect(figure(page, 'Total hours logged')).toHaveText('4h 0min');

  const absences = figure(page, 'Absences');
  await expect(absences.locator('span:text-is("Holiday") + span')).toHaveText(
    '2',
  );
  await expect(absences.getByText('Sick leave')).toBeHidden();
});

// @scenario statistics/Chart renders
test('the per-day chart is drawn for the in-window work entries', async ({
  page,
}) => {
  await seedWorklog({ from: utcTimeOn(-3, 8), to: utcTimeOn(-3, 12) });
  await seedWorklog({ from: utcTimeOn(-2, 8), to: utcTimeOn(-2, 14) });

  await page.goto('/statistics');

  const chart = page.locator('canvas');
  await expect(chart).toBeVisible();

  // A canvas is visible even when nothing has been painted onto it, so the
  // assertion is that pixels were actually drawn. Polled, because chart.js
  // animates the line in after mount.
  await expect
    .poll(() =>
      chart.evaluate((canvas: HTMLCanvasElement) => {
        const context = canvas.getContext('2d');
        if (!context) return false;
        const { data } = context.getImageData(
          0,
          0,
          canvas.width,
          canvas.height,
        );
        for (let i = 3; i < data.length; i += 4) {
          if (data[i] !== 0) return true;
        }
        return false;
      }),
    )
    .toBe(true);
});

// @scenario statistics/Worklog near UTC midnight
test('a worklog just after UTC midnight is grouped under its UTC date', async ({
  page,
}) => {
  // The e2e server runs in a negative-offset timezone, where 00:30 UTC is still
  // the previous evening. Grouping by local time would file this under day -3.
  await seedWorklog({ from: utcTimeOn(-2, 0, 30), to: utcTimeOn(-2, 1, 30) });

  await page.goto('/statistics');

  await expect(figure(page, 'Most hours per day')).toHaveText(
    `1h 0min on ${dayMonthYear(-2)}`,
  );
});

// @scenario statistics/No session or no settings
test('a user without settings gets no statistics at all', async ({ page }) => {
  await seedWorklog({ from: utcTimeOn(-3, 8), to: utcTimeOn(-3, 12) });
  await deleteSettings();

  await page.goto('/statistics');

  // The page bails out before rendering anything of its own, worklogs or not.
  await expect(page.getByRole('heading', { name: 'Statistics' })).toBeHidden();
  await expect(page.getByText('Total hours logged')).toBeHidden();
});
