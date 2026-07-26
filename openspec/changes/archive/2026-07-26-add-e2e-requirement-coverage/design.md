## Context

`spec-test-traceability` enforces that every scenario in `openspec/specs/` is covered
by some test or explicitly exempt. It is deliberately layer-agnostic. Measuring the
result shows what that leaves on the table:

```
                  requirements   with e2e   all-scenarios-exempt   undecided
  total                    86          7                     16          63
```

All 7 are `time-clock`. The 63 are not homogeneous, which is what shapes this design:

- **~19 no browser can observe** — the coverage tool itself (11), pool/duration config
  (4), timezone invariance (2), row mapping (1), JWT internals (1).
- **~14 a browser could prove but shouldn't** — `saldo`'s arithmetic. "Lunch break
  subtracted = 525 minutes" is pinned exactly by a three-line service test; asserting
  it through Chromium would be slower, more fragile and prove less.
- **~30 genuine user journeys** — worklog, settings, absence, statistics,
  expected-hours, auth.

Constraints discovered in the harness:

- **`page.clock` is browser-only.** The e2e server runs with the real system clock in
  `TZ=America/New_York`. Begin-date accrual, future-entry exclusion and working-day
  counting are all decided server-side and cannot be frozen from a test.
- **Every test is signed in.** The single `chromium` project carries `storageState`;
  there is no unauthenticated context.
- **Reset tokens are stored sha256-hashed**, so a test cannot recover one from the
  database — reset-password e2e would have to go through a mail stub.
- **`db.ts` resets only clock state.** No seed or reset helpers exist for worklogs,
  settings or overrides.
- **The suite is serial** (`workers: 1`, `fullyParallel: false`) and all tests share
  one seeded user.

## Goals / Non-Goals

**Goals:**

- Every requirement gets a deliberate, recorded answer: an e2e test, or an exemption
  naming why.
- Make the "which requirements lack end-to-end proof" question answerable from a
  committed file, the way scenario coverage already is.
- Close the aliased-test-import hole so no Playwright idiom yields silently
  uncoverable tests.
- Cover the app's core journeys — worklog CRUD, the saldo reaching the screen,
  settings changing it, absence fan-out, statistics — through a real browser.

**Non-Goals:**

- Per-scenario e2e requirements. Requirement level is the point.
- New annotation syntax. Layer is derived from the covering test's path.
- Parallelising the e2e suite. Accepted as serial.
- Making the server clock injectable.
- Auth e2e beyond annotating the sign-in that `auth.setup.ts` already performs.

## Decisions

### Requirement level, enforced with a decision per requirement

Each requirement SHALL have at least one scenario covered by a test under `e2e/`, or
an e2e exemption. A requirement whose scenarios are *all* scenario-exempt needs no
e2e decision — it cannot have coverage by definition, and this auto-clears
`user-guide-generation`'s 16 without anyone typing anything.

*Alternatives considered.* A **generated shrink-only baseline** of current gaps,
enforced not to grow — rejected because its whole purpose is to let a gap sit there
with nobody deciding, which is the opposite of the intent. A **capability-level bar**
("each capability has one e2e journey") — rejected as too weak: one "create a
worklog" test would tick worklog's box and leave edit and delete unproven. An
**opt-in list** of requirements that need e2e — rejected because new capabilities
would default to unenforced, reintroducing the invisible-gap problem.

The cost is real and up-front: 63 decisions in this change. That is the deliberate
trade — the same one the scenario gate made when it closed all 122 gaps before
switching on.

### Layer is derived, not declared

The tool already records each covering test's file path. A requirement has e2e
coverage when any of its scenarios is covered by a test whose path is under `e2e/`.
No annotation changes, nothing for a test author to remember, and no second thing to
keep in sync with the first.

### Categorised e2e exemptions

A second top-level key in `scripts/spec-coverage.exemptions.json`, keyed by
requirement:

```json
{
  "scenarios": [...],
  "requirementsWithoutE2e": [
    {
      "requirement": "saldo/Worked minutes net of lunch break",
      "category": "unit-appropriate",
      "reason": "Pure arithmetic pinned exactly at the service layer; a browser would prove less, slower."
    },
    {
      "requirement": "auth/Sign-up with validated credentials",
      "category": "harness-cost",
      "reason": "Needs a signed-out project and a mail stub; the confidence gained does not pay for that harness.",
      "coveredAt": "src/actions/__tests__/authActions.test.ts"
    }
  ]
}
```

Four categories: `no-ui` (no user-visible surface), `unit-appropriate` (observable but
pinned exactly lower down), `external-dependency` (a third party CI cannot drive),
`harness-cost` (declined; the setup outweighs the confidence).

*Why an enum and not just prose.* Fourteen `saldo` entries would otherwise each
restate the same reasoning in slightly different words — one decision written
fourteen times, unreviewable in bulk. A category makes the shape visible at a glance
and makes a *novel* reason stand out as needing thought.

*Why `coveredAt` only on `harness-cost`.* It is the only category that is a judgement
rather than a fact — the others assert something true about the requirement, while
this one asserts a trade was worth making. Pointing at the test that does cover it
makes the claim checkable, and an unresolvable path is a hard error. Requiring it
everywhere would be noise; `no-ui` requirements often have no meaningful pointer.

*Trade-off.* `harness-cost` is where future rubber-stamping will land. Nothing in the
tool can prevent that. The mitigation is that it is one grep away in a committed
file, and every entry names a file a reviewer can open.

### Requirements become identifiers

`<capability>/<Requirement name>`. This is new: scenario ids deliberately exclude the
requirement so a scenario can move between requirements freely, and that stays true.
But an e2e exemption must name a requirement, so renaming one now breaks its
exemption — a hard error naming the old id.

That is the same bargain annotations already make with scenario titles, and the same
justification: the break is the signal that a human should re-read the decision.

### Aliased test imports

The scanner's opener regex knows `it`, `test` and `describe`. Playwright's setup
convention is `import { test as setup } from '@playwright/test'`, so `setup('...')`
matches nothing. Crucially this fails *silently* — there is no annotation to be
malformed, so nothing errors; the test is simply uncoverable. That is the one
behaviour the tool exists to make impossible.

The scanner will collect aliases from `import { test as X }` / `import { it as X }`
declarations in the file and treat `X` as an opener. Still line-based, still no AST.

This is a correctness fix independent of the rest of the change, and it pays for
itself immediately: `auth.setup.ts` drives the real credentials form on every run, so
`auth/Email/password sign-in` becomes honestly covered rather than exempted.

### Date-agnostic e2e assertions

`page.clock` cannot reach the server, so tests must not depend on what the server
thinks today is. Tests will seed relative to the current date and assert
*relationships* rather than absolute values — "the badge falls by exactly one
expected day after adding a flex absence", not "the badge reads -7h 30min".

*Alternative considered.* Making `now()` in `src/util/date.ts` honour an env var so
the e2e server can be frozen. Rejected: it bends production code for tests, and a
mis-set variable in production would silently corrupt every saldo on the site. The
blast radius is not worth the stronger assertions.

*Consequence, stated plainly.* Several statistics and settings e2e tests will assert
less than their unit counterparts do. They are proving the wiring — that the computed
value reaches the screen and responds to input — not re-proving the arithmetic. Where
a scenario's THEN names an absolute figure, the unit test remains the real assertion
and the e2e test covers the requirement's journey.

### Auth stays at the unit layer

Six auth requirements are exempted as `harness-cost` and one (OAuth) as
`external-dependency`. Testing them needs an unauthenticated Playwright project, a
mail stub, and a way around sha256-hashed reset tokens — three pieces of harness for
a capability already covered at the action and repository layers.

This is the change's most debatable call, which is why `coveredAt` exists: each entry
names the suite that does test it.

## Risks / Trade-offs

- **63 decisions written in one pass.** → The enum makes them reviewable in bulk, and
  the split between fact-categories and `harness-cost` directs scrutiny where it
  belongs.
- **Weaker e2e assertions from the date-agnostic rule.** → Accepted deliberately; the
  unit layer keeps the exact assertions and e2e proves the wiring.
- **CI time roughly quintuples for the e2e job** (~2 min to ~8–10 min). → Accepted.
  Parallelising needs per-worker user isolation, which is its own change.
- **Shared seeded user across serial tests** means a leaked row breaks the next test.
  → Reset helpers run between tests, in the shape `resetClockState` already
  establishes.
- **Renaming a requirement breaks its exemption.** → Intentional, hard error, mirrors
  scenario renames.
- **This capability's own new requirements need e2e decisions too.** → All `no-ui`;
  the tool has no UI.

## Migration Plan

Same ordering problem as last time, and the same answer. The new requirements added
to `spec-test-traceability` only become canonical at archive, but the gate they
describe runs against canonical specs — so `/opsx:sync` runs as an implementation
step before enforcement is switched on, and the archive is then just the folder move.

The tool ships report-only first: requirement-level e2e coverage appears in
`openspec/COVERAGE.md` while gaps remain, and enforcement turns on once the 25 test
suites and 37 exemptions are in place. No CI change is needed — `spec:coverage:ci`
already runs `--check --strict`; the new rule rides along with it. Rollback is
removing the requirement-level check from the script.
