# mutation-safety Specification

## Purpose

This capability governs the boundary between a user's interaction and the write it
triggers: one activation of a control produces at most one mutation, however
quickly the control is activated and however slowly the server answers. It covers
the in-flight gate on every client-triggered write, the silent dropping of a
re-entrant submission, and the rule that a submission which never ran reports
nothing.

It is cross-cutting rather than tied to one feature. Every mutation reachable from
a client component is in scope, because the failure it prevents — the same time
logged twice from one tap — is a property of the write path, not of any particular
form.

## Requirements

### Requirement: One interaction produces at most one mutation

Every client-triggered mutation SHALL be gated so that repeated activation of the
same control, while a previously started mutation for that control is still in
flight, starts no additional mutation. The gate SHALL take effect synchronously
at the moment the control is activated, so that two activations occurring before
the interface has re-rendered are still distinguished.

The gate covers the whole operation, from the moment the control is activated
until the server has responded and any resulting interface update has been
applied — not merely the interface update.

This rule applies to every mutation reachable from a client component, including
creating, editing and deleting a worklog, submitting an absence range, saving
settings, saving and clearing an expected-hours override, clocking in, and
clocking out or discarding a session.

#### Scenario: Second activation during an in-flight mutation is dropped

- **GIVEN** a control whose mutation has been started and has not yet completed
- **WHEN** the control is activated again
- **THEN** no second mutation is started
- **AND** the first mutation completes normally

#### Scenario: Two activations before the interface re-renders

- **WHEN** a control is activated twice in quick succession, the second time before any re-render caused by the first has been applied
- **THEN** exactly one mutation is started

#### Scenario: The gate spans the server round-trip

- **GIVEN** a mutation whose server call has been issued and not yet returned
- **WHEN** the control is activated again during that window
- **THEN** no second mutation is started

#### Scenario: A later interaction is not blocked

- **GIVEN** a mutation that has completed
- **WHEN** the control is activated again
- **THEN** a new mutation is started

#### Scenario: The gate is released after a failure

- **GIVEN** a mutation that failed
- **WHEN** the control is activated again
- **THEN** a new mutation is started, so a failure does not leave the control permanently inert

### Requirement: A control is visibly unavailable while its mutation runs

While a mutation started from a control is in flight, that control SHALL be
presented as unavailable, so the interface does not invite the repeat activation
the gate silently discards.

#### Scenario: Control is disabled during the mutation

- **WHEN** a mutation is started from a control
- **THEN** that control is disabled for as long as the mutation is in flight

#### Scenario: Control becomes available again

- **WHEN** the mutation completes, whether it succeeded or failed
- **THEN** the control is no longer disabled

#### Scenario: Existing validity gating still applies

- **GIVEN** a control that is already disabled because its form input is invalid
- **WHEN** the input remains invalid after a mutation completes
- **THEN** the control stays disabled

### Requirement: A dropped submission reports nothing

A submission discarded by the gate SHALL produce no user-visible outcome: no
success notification, no error notification, and no change to the displayed data.
The user SHALL observe only the result of the single mutation that ran.

#### Scenario: No success notification for a dropped submission

- **GIVEN** a control activated twice, where the second activation was dropped by the gate
- **WHEN** the first mutation succeeds
- **THEN** exactly one success notification is shown

#### Scenario: No error notification for a dropped submission

- **WHEN** an activation is dropped by the gate
- **THEN** no error notification is shown, because nothing failed

#### Scenario: Dropped submission leaves the view unchanged

- **WHEN** an activation is dropped by the gate
- **THEN** no entry is added to, removed from, or altered in the displayed list
