## ADDED Requirements

### Requirement: A stored work entry spans a positive, bounded length of time

The database SHALL reject a worklog whose `to` is not strictly later than its
`from`, and one whose span exceeds one day. This is a constraint on stored
records, enforced by the database itself, not only a validation applied to
submissions — the guarantee other behaviour relies on is about what is *in* the
table, and application-level validation has been bypassed in the past.

The bound exists because the overlap read derives its lower bound from it: if a
stored entry could span an unlimited length of time, no lower bound on that read
could be proven safe.

The limit is deliberately looser than the rule requiring a worklog to start and
end on the same day. That rule governs what may be submitted; this one governs
what may be stored, and the two are kept separate so that relaxing the input rule
does not silently invalidate the read.

Records already stored that violate the positive-span rule SHALL be removed rather
than adjusted, because an entry ending no later than it starts records no work and
any adjustment would invent data that was never entered.

#### Scenario: A zero-length entry is rejected

- **WHEN** a worklog whose `to` equals its `from` is written directly to the database
- **THEN** the write is rejected by the database

#### Scenario: An inverted entry is rejected

- **WHEN** a worklog whose `to` precedes its `from` is written directly to the database
- **THEN** the write is rejected by the database

#### Scenario: An over-long entry is rejected

- **WHEN** a worklog spanning more than one day is written directly to the database
- **THEN** the write is rejected by the database

#### Scenario: An ordinary entry is unaffected

- **WHEN** a worklog spanning a normal working day is written
- **THEN** it is stored, and no existing worklog behaviour changes

#### Scenario: Existing violating rows are removed before the rule takes effect

- **GIVEN** a database holding a work entry whose `to` is not later than its `from`
- **WHEN** the constraint is introduced
- **THEN** that entry is deleted first, so the constraint applies to a table that already satisfies it

#### Scenario: An over-long stored row stops the rollout rather than being altered

- **GIVEN** a database holding a work entry spanning more than one day
- **WHEN** the constraint is introduced
- **THEN** the change fails and is rolled back, leaving the entry untouched for a person to decide about
