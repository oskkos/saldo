## 1. Data model

- [ ] 1.1 Add `expected_minutes_per_day Int @default(450)` to the `Settings` model in `prisma/schema.prisma`.
- [ ] 1.2 Add an `ExpectedHoursOverride` model (`id`, `user_id` + `user` relation, `date DateTime`, `minutes Int`, `label String?`, timestamps) with `@@unique([user_id, date])`.
- [ ] 1.3 Create the migration and run `prisma generate` (client outputs to `src/generated/prisma`).

## 2. Domain types & the resolver

- [ ] 2.1 Extend `Settings`/`SettingsData` in `src/types` with `expectedMinutesPerDay`; add an `ExpectedHoursOverride` domain type (`date`, `minutes`, `label?`).
- [ ] 2.2 Add `resolveExpectedMinutes(date, settings, overrides)` to `src/services`: override → `0` if `isNonWorkingDay` → `settings.expectedMinutesPerDay`. Pure, no DB/session.
- [ ] 2.3 Unit-test the resolver: default working day, weekend/holiday → 0, override present, override on a weekend wins, override of 0.

## 3. Wire the resolver into saldo & calendar

- [ ] 3.1 `expectedMinutesUntilToday`: accrue `resolveExpectedMinutes` per day instead of the fixed `EXPECTED_HOURS_PER_DAY`. Thread `overrides` into `calculateCurrentSaldo`.
- [ ] 3.2 Non-flex absence credit: credit the day's resolved expected (branch on resolved-expected > 0, not `isNonWorkingDay`).
- [ ] 3.3 `miniCalendar/dayItem.tsx`: replace the hardcoded `450` with the day's resolved expected; border color keys off it; add a **dashed** border style for override days. Reorder the border logic to branch on resolved-expected (0 = non-working) rather than `isNonWorkingDay`.
- [ ] 3.4 Plumb `expectedMinutesPerDay` + overrides from the home page → `MiniCalendar` → `daysForCalendarBuilder` → `DayItem` so each day knows its resolved expected.
- [ ] 3.5 Update/extend saldo service tests: overridden short day accrual, absence on an overridden day nets to 0, configurable default changes the accrual.

## 4. Settings: configurable default

- [ ] 4.1 `settingsRepository` — carry `expected_minutes_per_day` through `toSettings`, `insertSettings`, `upsertSettings`.
- [ ] 4.2 `SettingsSchema` — validate `expectedMinutesPerDay` as a non-negative integer within bounds; thread through the settings action.
- [ ] 4.3 Settings form — add an hours:minutes field for the default (reuse `IntegerInput`), with a one-line retroactivity note. Its Submit still saves only the scalar settings.

## 5. Per-date overrides: repository, actions, schema

- [ ] 5.1 New `expectedHoursOverrideRepository` (server-only): list overrides for the current user, and create/update (upsert on `user_id`+`date`) / delete with per-user ownership enforcement and Sentry spans; add a mapper to the domain type.
- [ ] 5.2 New Zod schema for an override (date present, minutes non-negative integer within bounds, optional label length-capped).
- [ ] 5.3 New server actions in `src/actions` for override create/update/delete, validating with the schema before delegating.

## 6. Per-date overrides: UI

- [ ] 6.1 Settings page — a "Special days" section: list existing overrides (date, hours, label, edit/delete) and an add control (date + hours:minutes + optional label), each using its own action independent of the settings Submit.
- [ ] 6.2 Day view (`worklogEntry`) — a `Expected today: Xh (custom)` line and an inline editor to set/clear the day's override.
- [ ] 6.3 Load the user's overrides where needed (home page for the calendar, day view for the day, settings for the list).

## 7. Verify

- [ ] 7.1 Run `npm run test:ci` and `npm run lint`; add component tests for the settings default field, the special-days list CRUD, and the calendar override coloring/dashed border.
- [ ] 7.2 Manually verify in the running app: set a default; add a short-day override; confirm the day view shows it, the calendar colors it green when worked in full with a dashed border, the saldo accrues the reduced expectation, and an absence on that day nets to zero.
