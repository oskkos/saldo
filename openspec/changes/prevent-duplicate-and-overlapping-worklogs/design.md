## Context

Two user reports, one missing invariant. Nothing in the write path compares a new
worklog against what is already stored, and nothing in the UI prevents a second
submission while the first is in flight.

```
        ┌───────────── write paths into `worklog` ──────────────┐
  /worklog-entry ──┐
  quickAddModal ───┼──▶ actions ──▶ worklogRepository.insertWorklog   ◀─ absence guard only
  /absence ────────┘                worklogRepository.insertWorklogs  ◀─ absence guard only
  editModal ───────────────────────▶ worklogRepository.updateWorklog  ◀─ absence guard only
  clockOutModal ───────────────────▶ clockRepository.clockOutWithWorklog  ◀─ no guard
```

`assertAbsenceDaysAreFree` (`worklogRepository.ts`) is the only stateful
invariant on the whole surface. It answers absence-vs-absence. Work-vs-work is
unguarded, and a double-tap is simply the case where the two intervals coincide.

On the client, `useTransitionWrapper` returns `[isPending, run]` and **all ten
consumers discard `isPending`** (thirteen invocations between them). It would not
have helped if they had not:

```ts
const run = async (action, callback) => {
  const ret = await action();     // ← the server round-trip, isPending === false
  startTransition(() => {         // ← isPending goes true only now
    callback?.(ret);
    router.refresh();
  });
};
```

The flag covers the local re-render, never the network. The window a second tap
lands in is precisely the window the flag reports as idle.

Two constraints shape everything below. First, **work on an absence day is a
supported combination** — `worklogEntry.tsx` renders a note encouraging it, and
the archived `prevent-duplicate-absences` change lists it as a goal — so overlap
cannot be a blanket rule. Second, **a production build replaces a thrown error's
message with an opaque digest**, so any outcome the user must read has to come
back as a value (`onAbsenceSubmit` is the existing worked example).

## Goals / Non-Goals

**Goals:**

- One user interaction produces at most one mutation, on every client write path.
- A dropped re-entrant submission is silent: nothing written, nothing reported.
- A work entry that overlaps a stored work entry is surfaced to the user before
  it is saved, naming the entry it collides with, and is saved only if confirmed.
- Overlap is checked on the server against stored state, not against whatever the
  client happens to have rendered.
- Clocking out twice produces one worklog.
- The read a write now performs is index-backed.

**Non-Goals:**

- Detecting, reporting, or repairing duplicate or overlapping rows already
  stored.
- A database-level exclusion constraint.
- Preventing overlap outright — the user may confirm through it.
- Changing how the saldo treats overlapping entries once they exist.
- Absence-vs-absence uniqueness, which already exists and is untouched.
- Reworking `validateOrThrow` for the non-worklog actions (settings, overrides).

## Decisions

### The re-entrancy guard is a ref inside the hook, not `isPending`

`useTransitionWrapper` manages its own busy state:

```
  run(action, callback)
    │
    ├─ busyRef.current ? ──yes──▶ return false        ← synchronous, no re-render needed
    │                                                    the dropped tap ends here
    ├─ busyRef.current = true; setBusy(true)
    ├─ const ret = await action()
    ├─ startTransition(() => { callback(ret); router.refresh() })
    └─ finally: busyRef.current = false; setBusy(false)
           returns true
```

Returns `[busy, run]`; call sites become `const [busy, run] = …` and pass
`disabled={busy}` (or `confirmDisabled={busy || !inputsValid}`) to their control.

**Why a ref and not the `busy` state alone.** Two taps within one frame both read
the pre-render value of a state variable, and `disabled` only takes effect after
React commits. The ref is written synchronously in the same tick as the first
tap, so the second call sees it. The state exists for the visual affordance; the
ref exists for correctness.

**Why not React 19's async transitions.** `startTransition(async () => …)` does
hold `isPending` across the await, which fixes the reporting bug. It does not fix
the same-frame race, and the rules governing updates issued after the `await`
inside a transition are subtle enough that getting them wrong across thirteen
invocations is a likely outcome. A self-managed flag is smaller and directly
testable.

### A dropped submission resolves to `false`, and call sites gate their toast on it

Every call site today chains `.then(() => setMsg({ type: 'success', … }))`. If a
swallowed tap resolved like a successful one, the user would see "Worklog
created" for a write that never happened — the same class of false report this
change exists to remove.

`run` therefore resolves to `boolean`: `true` when the action ran, `false` when
it was dropped. Call sites become `.then((ran) => { if (ran) setMsg(…) })`.

**Alternative rejected:** having the hook own the toast. It would remove the
per-site discipline, but the toasts carry different messages and two sites build
React elements rather than strings; pushing that into a generic hook trades one
kind of coupling for a worse one.

### Overlap is detected in the repository, beside the ownership check

Same reasoning the archived absence change recorded, and the same location: it is
a state-dependent invariant that needs a read before the write, and not every
write reaches the table through `insertWorklog` — `clockRepository` creates its
own row.

**Why not client-side pre-flight.** `worklogEntry.tsx` already holds the day's
worklogs in state, so checking there costs no round-trip. But the reported bug
*is* stale client state: the second device rendered its list before the first
device wrote. A client check passes in exactly the scenario that needs to fail.

### Overlap means half-open intervals, work against work

Two entries overlap when `a.from < b.to && b.from < a.to` — strict on both sides,
so touching ends do not collide:

```
  08:00      12:00      16:00
    ├──── A ────┤                       A = 08:00–12:00
                ├──── B ────┤           B = 12:00–16:00   adjacent, not overlapping
    ├──── A ────┤
         ├──── C ────┤                  C = 10:00–14:00   overlapping
```

Rows with a non-null `absence` are excluded from the query, and an incoming entry
that carries an `absence` skips the check entirely — it has its own one-per-day
guard. Without both halves of that exemption, every legitimate hours-on-an-
absence-day entry would raise a conflict.

An edit excludes the row being edited from its own comparison, or nudging an
entry's end time would always collide with itself.

The candidate query is bounded by the incoming interval
(`from < newTo AND to > newFrom`), not by the calendar day, so it needs no
day-boundary reasoning — though a valid worklog is single-day by existing
validation, so the range is small either way.

### The conflict is returned, confirmed client-side, and re-submitted with an override

```
   Save
     │
     ▼
   onWorklogSubmit(data)  ──▶ overlaps? ──no──▶ insert ──▶ { status: 'success', worklog }
                                  │
                                 yes
                                  ▼
                    { status: 'conflict', conflicts: [ { from, to } ] }
                                  │
                                  ▼
              window.confirm('This overlaps 09:00–17:00. Save anyway?')
                    │                              │
                  cancel                        confirm
                    │                              ▼
                 nothing        onWorklogSubmit(data, { allowOverlap: true }) ──▶ insert
```

`onWorklogSubmit`, `onWorklogEdit`, and `onClockOut` return a discriminated union
in the shape of the existing `AbsenceSubmitResult`: `success`, `conflict`, or
`error`. Validation failures move onto the same channel rather than throwing, so
a caller has one place to look instead of two.

**Why two round-trips instead of sending the day's entries up with the request.**
The client's copy is the thing we established cannot be trusted. A pre-check
endpoint would be a third action to keep in sync with the write.

**Consequence:** because the user can confirm through it, the invariant is
advisory. It cannot be expressed as a database constraint, which is why the
proposal lists one as a non-goal rather than an unfinished task.

**Accepted race:** between the check and the insert, a concurrent write could
create an overlap that neither call saw. Both writes belong to the same user
acting on two devices within milliseconds; the outcome is the pre-existing
behaviour, and the confirm-through design means it is not a violated guarantee.

### The prompt is `window.confirm`

Already the idiom for a destructive confirmation in this codebase
(`clockOutModal.tsx` guards Discard with it). The alternative — a second
`<dialog>` over an open one — is a real problem here rather than a stylistic
preference, because the conflict can arrive while a modal is open and daisyUI
modals are native dialogs.

### `Modal`'s confirm button becomes `type="button"` with an explicit close

`Modal` renders its actions inside `<form method="dialog">`, so the confirm button
dismisses the dialog the instant it is tapped — before the server has answered.
The conflict prompt would then appear over a modal that is already gone, and
cancelling would leave the user with their input hidden behind a closed dialog.

The component already does exactly this for `secondaryAction`, with a comment
explaining why ("lets a confirm prompt cancel without dismissing the modal"). The
change generalises that to the confirm button: `type="button"`, and the modal
closes when the action reports success.

### Clock-out closes the session conditionally

`clockOutWithWorklog` writes a worklog and nulls `started_at` in a transaction,
but never checks that a session was open, so two concurrent clock-outs both
write. `clockIn`, directly above it, already models the fix with
`updateMany({ where: { started_at: null } })`. Clock-out mirrors it: update the
user row conditionally on `started_at` being non-null, and create the worklog
only when that update affected a row.

### The worklog table gains an index on `(user_id, from)`

Every create and edit now performs a bounded read that did not exist before. The
table carries no index beyond the primary key today. `getWorklogs` filters on the
same columns and benefits from the same index.

## Risks / Trade-offs

- **A call site forgets to gate its success toast on `run`'s result** → the
  boolean is the return value rather than an out-parameter, so the gate is
  visible at the call site; the change touches all thirteen invocations in one
  pass and the notifying paths get a test asserting no toast on a dropped call.
- **`type="button"` changes dismissal for every modal, not just worklog ones** →
  delete-confirm, clock-out and quick-add all route through `Modal`; each needs
  its close path re-checked, and the e2e suite already drives these flows.
- **The extra round-trip on a confirmed overlap doubles the write latency for
  that case** → it applies only to the confirm path, which is by construction
  rare and already gated on a human reading a prompt.
- **`window.confirm` is modal to the whole tab and cannot be styled** → accepted;
  it is the established pattern here and the alternative is materially harder.
- **The overlap read adds a query to every worklog write** → bounded by the
  incoming interval and index-backed by the migration in this change.
- **Users who legitimately log overlapping entries now see a prompt every time**
  → they can confirm through it; nothing becomes impossible.
- **Existing overlapping rows stay wrong and unreported** → an explicit non-goal;
  the saldo they produce is unchanged by this work.

## Migration Plan

1. Prisma migration adding the `(user_id, from)` index. Additive, no data change,
   safe to apply ahead of the code.
2. Deploy the code. The action return-type change is internal — server actions and
   their callers ship in the same bundle, so there is no version skew to manage.
3. Rollback is the previous deploy; the index can be left in place.

No backfill, no data repair, nothing to reconcile.

## Open Questions

- Should a confirmed overlap be recorded (a flag or comment marker) so a future
  reporting surface can distinguish deliberate overlaps from accidental ones? Not
  needed for this change; it would be cheap to add now and expensive to
  reconstruct later.
