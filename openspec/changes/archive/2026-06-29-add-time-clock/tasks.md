## 1. Data model

- [x] 1.1 Add `started_at DateTime?` to the `User` model in `prisma/schema.prisma`.
- [x] 1.2 Create the migration (hand-written if needed) and run it; `prisma generate`.
- [x] 1.3 Add an active-session type to `src/types` (e.g. `ActiveSession { startedAt: Date }` or `null`).

## 2. Repository + actions

- [x] 2.1 Add a clock repository module: `getActiveSession()` (reads `started_at` for the session user), `clockIn(startedAt)` (sets it; no-op if already set), `clearSession()` (nulls it). Wrap DB calls in `Sentry.startSpan`; gate on `getUserFromSession()`.
- [x] 2.2 Add actions in `src/actions`: `onClockIn(startedAt)`, `onClockOut(data)` (validate, create worklog via `insertWorklog`, then clear session), `onClockDiscard()` (clear session, no worklog). Validate the worklog data with the existing `WorklogSchema` (enforces same-day + to>from).
- [x] 2.3 Ensure clock-out save path reuses `insertWorklog` so all existing worklog validation/ownership applies.

## 3. UI — clock card (home)

- [x] 3.1 Add a client `ClockCard` component: start (clock-in) button when idle; live elapsed timer (`setInterval`, isolated) + clock-out button when running. Use daisyUI card/btn and the existing success-color language; react-icons for play/stop.
- [x] 3.2 Render `ClockCard` on the home page below the calendar; read the active session server-side (like `Navbar` reads settings/worklogs) and pass it in.

## 4. UI — finalize sheet

- [x] 4.1 Build the finalize sheet (daisyUI modal, following `quickAddModal`): shows duration, lunch-break toggle (default from app default), optional comment; actions Save / Discard / Cancel.
- [x] 4.2 Corrective mode: when the session crosses midnight or is implausible, open the sheet pre-filled with the end time editable and constrained to the start day; block Save until same-day; allow Discard.
- [x] 4.3 Wire Save → `onClockOut`, Discard (with confirm) → `onClockDiscard`, Cancel → dismiss (remain clocked in).

## 5. UI — global badge indicator

- [x] 5.1 Add a clocked-in indicator (a pulsing dot) to the saldo badge area in the navbar, linking to the home screen where the user clocks out. Read active session in the layout/navbar server fetch.

## 6. Verify

- [x] 6.1 Tested the pure cross-midnight logic (extracted to clock/util.ts). NOTE: RTL/action tests that load the components pull in 'use server' actions -> the Prisma client, which jest cannot load (no such tests exist in the repo); the happy path + finalize sheet were verified in-browser on the mobile viewport, and overnight/same-day rejection is covered by the existing WorklogSchema tests.
- [x] 6.2 Run `npm run test:ci` (under the pinned timezone) and `npm run lint`.
- [x] 6.3 Manually verify on mobile viewport: clock in → live timer → clock out → finalize (save/discard), badge indicator, and the forgotten/overnight corrective path.
