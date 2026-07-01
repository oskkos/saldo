## Why

Expected daily hours are hardcoded to 7.5 (`EXPECTED_HOURS_PER_DAY`). Users need
(a) to configure their own default, and (b) to mark specific days as short — e.g.
the 5–6h days Finnish workplaces run before Midsummer, Christmas, and New Year.
Today the only workarounds are dishonest (logging phantom hours, which corrupts
statistics) or impossible (a reduced-obligation day cannot be expressed at all),
so absences net wrong on such days.

## What Changes

- **Configurable default expected hours** per user, stored on `Settings` as
  minutes (default 450 = 7.5h), editable on the settings page.
- **Per-date expected-hours overrides**: a user can set an absolute expected
  value (e.g. 5h) for a specific date, with an optional label/note. Managed as a
  batch list on the settings page; each day also shows its resolved expected.
- **A single `resolveExpectedMinutes(date)`** becomes the source of truth for
  "how many minutes are expected on this day": `override → 0 if non-working →
  configurable default`. It replaces three scattered references to 7.5h and is
  consumed by all three:
  1. the saldo expected-sum,
  2. the non-flex absence credit (so an absence still nets the day to zero — now
     against the day's *resolved* expected, not a fixed 7.5h), and
  3. the mini-calendar day coloring, which currently hardcodes `450`
     (`dayItem.tsx`). Coloring becomes threshold-aware, and override days get a
     distinct **dashed border** so a short day worked in full reads as met (green)
     rather than under-target.
- Changing the default recomputes the whole historical balance (it is
  retroactive); the settings UI states this plainly.

### Non-Goals (deliberately excluded)

- **Configurable lunch break** (`EXPECTED_MINUTES_LUNCH_BREAK`) — a different
  concern (a worked-time deduction, not an expected obligation); no one has asked,
  and it is trivial to add later with the same settings-scalar pattern.
- **Recurring overrides** — the client's short days are not recurring.
- **Deriving overrides from the holiday calendar**, **custom weekly working-day
  patterns** (axis-B), and **effective-dated rate ranges** (Model 3).
- **Per-day balance display** on the day view.

## Capabilities

### New Capabilities

- `expected-hours`: how expected minutes for a given date are resolved
  (per-date override → non-working day → configurable default), and the per-date
  override records with their per-user CRUD, validation, and ownership.

### Modified Capabilities

- `saldo`: the expected-minutes accrual and the non-flex-absence credit stop
  using the fixed 7.5h constant and use the per-day resolved expected instead.
- `settings`: settings gain a configurable expected-minutes-per-day value, with
  server-side validation alongside the existing fields.

## Impact

- **Domain/services:** new `resolveExpectedMinutes(date, settings, overrides)` in
  `src/services`; `expectedMinutesUntilToday` and the absence credit in
  `services/index.tsx` call it; the `450` magic number in
  `components/miniCalendar/dayItem.tsx` is replaced by the resolved value, and its
  border logic keys off resolved-expected instead of `isNonWorkingDay`.
- **Data model:** `Settings` gains `expected_minutes_per_day` (Int, default 450);
  new `ExpectedHoursOverride` table (`user_id`, `date`, `minutes`, optional
  `label`, unique on `user_id`+`date`). Prisma migration + `prisma generate`.
- **Types/schemas:** `Settings`/`SettingsData` gain the default field;
  `SettingsSchema` validates it; new override domain type + Zod schema.
- **Repository/actions:** new override repository (server-only, per-user
  ownership, Sentry spans) and server actions for override create/update/delete;
  `settings` mapper/insert/upsert carry the new field.
- **UI:** settings page — new default field + a "Special days" section with
  independent add/edit/delete (not tied to the settings Submit); day view — a
  read `Expected today: Xh (custom)` line + inline override editor; mini-calendar
  — threshold-aware coloring + dashed-border override indicator (requires the
  default + overrides to be plumbed into `MiniCalendar`).
- **No change** to the lunch-break constant or the worklog data model.
