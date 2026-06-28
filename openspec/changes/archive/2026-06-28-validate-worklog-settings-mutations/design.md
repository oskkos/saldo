## Context

`src/actions/index.ts` exposes the only write path for worklogs and settings.
Today `onWorklogSubmit`, `onWorklogEdit`, and `onSettingsUpdate` forward their
argument straight to the repository. Validation exists only in the client forms
(`worklogEntry.tsx`, `worklogEditModal.tsx`, `settings.tsx`), which check
date/time *format* via `assertIs*` and, for settings, that from < to. Nothing
re-validates on the server. The auth actions already follow the project's
documented pattern (Zod `safeParse` in the action), so this change brings the
worklog/settings actions in line with both the auth precedent and `CLAUDE.md`.

## Goals / Non-Goals

**Goals:**
- Re-establish data invariants server-side so invalid worklogs/settings cannot be
  persisted regardless of the caller.
- Reuse the existing Zod-in-the-action pattern and the existing toast error path.

**Non-Goals:**
- Editing an absence reason (the edit form omits `absence`; separate proposal).
- Overlap/duplicate detection (separate proposal).
- Rewriting the worklog/settings forms to use react-hook-form.
- Changing the repository layer or the saldo calculation.

## Decisions

**Decision: Validate in the action layer with Zod.**
Matches `CLAUDE.md` ("actions validate input with Zod, then delegate to
repositories") and the auth actions. New schemas live under `src/schemas/`
(e.g. `worklogSchema`, `settingsSchema`), parsed in the action.

**Decision: Report failures as thrown errors, not structured field errors.**
The auth actions return `{status:'error', errors}` because their forms use
react-hook-form. The worklog and settings forms do NOT — they use manual
`useState` and their submit handlers already `.catch(e => toast(e.message))`. So
throwing an `Error` with a clear message integrates with the existing UX with no
form rewiring. This is a deliberate divergence from the auth pattern, justified
by the different form machinery.

- *Alternative considered: structured `{status, errors}` returns.* Rejected — it
  would require converting both forms to react-hook-form for no user-visible
  benefit, expanding scope well beyond validation.

**Decision: Validate `from`/`to` as `Date` values with a `to > from` refinement.**
`WorklogFormData` reaches the action already converted to `{from: Date, to: Date}`
on the client; Next.js server actions preserve `Date` across the boundary. So the
schema uses `z.date()` plus a `.refine(d => d.to > d.from)`. Zero-duration is
rejected (strict `>`).

## Risks / Trade-offs

- [Server-action `Date` serialization edge cases] → Mitigated by validating with
  `z.date()` and adding unit tests that feed the schema raw values.
- [Tightening rules could reject data that somehow exists today] → Low risk
  (UI already enforced format); but worth a quick check that no legitimate flow
  produces `to === from` before shipping.
- [Divergent error styles across actions (throw vs structured)] → Accepted and
  documented; the split tracks the form machinery, not inconsistency for its own
  sake.

## Resolved Decisions

- **Comment max length** — capped at **1000 characters**.
- **Worklog span** — a worklog MUST fall on a **single calendar day**: `from` and
  `to` share the same UTC date, with `to` strictly after `from`. This is stricter
  than a 24h bound and matches what the day+time entry UI produces.
- **Initial-balance sign** — a **negative** starting balance is **allowed**
  (legitimately "starting in deficit"). Hours are bounded in magnitude; minutes
  are constrained to 0–59.
