## ADDED Requirements

### Requirement: Every requirement has end-to-end coverage or a stated exemption

Each requirement in `openspec/specs/` SHALL have at least one of its scenarios
covered by a test in the Playwright layer, or SHALL carry an explicit end-to-end
exemption. Enforcement is at requirement level rather than scenario level, so a
requirement is satisfied by one end-to-end test of its journey without demanding a
browser test for every rule beneath it.

A requirement whose scenarios are all scenario-exempt SHALL NOT require an
end-to-end decision, since it cannot have coverage of any kind.

#### Scenario: Requirement covered by one end-to-end test

- **GIVEN** a requirement with several scenarios
- **WHEN** any one of them is covered by a test in the Playwright layer
- **THEN** the requirement satisfies the end-to-end rule

#### Scenario: Unit-only requirement is reported as a gap

- **WHEN** every scenario of a requirement is covered only by tests outside the
  Playwright layer, and no end-to-end exemption exists for it
- **THEN** the requirement is reported as lacking end-to-end coverage

#### Scenario: Fully exempt requirement needs no end-to-end decision

- **GIVEN** a requirement whose scenarios are all scenario-exempt
- **WHEN** end-to-end coverage is evaluated
- **THEN** the requirement is not reported as a gap and needs no end-to-end
  exemption

#### Scenario: End-to-end exemption resolves the requirement

- **WHEN** a requirement without Playwright coverage carries an end-to-end exemption
- **THEN** it is not reported as a gap

### Requirement: End-to-end coverage is derived from the test's location

The tool SHALL determine whether a test belongs to the end-to-end layer from the
path of the file it is declared in, not from anything the test author writes. No
annotation syntax SHALL be required to declare a test's layer.

#### Scenario: Layer read from the test's path

- **WHEN** a scenario is covered by a test declared under the Playwright directory
- **THEN** that coverage counts as end-to-end for the scenario's requirement

#### Scenario: Declaring the layer costs the author nothing

- **WHEN** a test moves between layers, or a new end-to-end test is written
- **THEN** its existing `// @scenario` annotations are sufficient, with no
  layer-specific syntax added or changed

### Requirement: End-to-end exemptions are categorised

An end-to-end exemption SHALL name the requirement it applies to, a category drawn
from a fixed set, and a written reason. The categories SHALL be `no-ui` (the
requirement has no user-visible surface), `unit-appropriate` (observable, but pinned
precisely at a lower layer), `external-dependency` (requires a third party the test
environment cannot drive), and `harness-cost` (deliberately declined because the
test setup required outweighs the confidence gained).

A category outside that set SHALL be a hard error, so a new kind of reason has to be
argued for rather than slipped in.

#### Scenario: Exemption records a category and a reason

- **WHEN** an end-to-end exemption is declared for a requirement
- **THEN** it carries one of the defined categories and a written reason

#### Scenario: Unrecognized category is rejected

- **WHEN** an end-to-end exemption names a category outside the defined set
- **THEN** the tool exits non-zero and names the offending entry

#### Scenario: Exemption without a reason is rejected

- **WHEN** an end-to-end exemption has an empty or missing reason
- **THEN** the tool exits non-zero and names the offending entry

### Requirement: Cost-based exemptions name the layer that covers them

An exemption in the `harness-cost` category SHALL additionally name the test file
that does cover the requirement, and that file SHALL exist. This category asserts
that a trade was worth making rather than a fact about the requirement, so the claim
is made checkable; the other categories SHALL NOT require it.

#### Scenario: Cost-based exemption must point at real coverage

- **WHEN** a `harness-cost` exemption omits the covering test file
- **THEN** the tool exits non-zero and names the offending entry

#### Scenario: Pointer to a missing file is rejected

- **WHEN** a `harness-cost` exemption names a file that does not exist
- **THEN** the tool exits non-zero and names the entry and the missing path

#### Scenario: Other categories need no pointer

- **WHEN** an exemption in any other category omits a covering test file
- **THEN** it is accepted

### Requirement: End-to-end exemptions cannot rot

An end-to-end exemption naming a requirement that does not exist SHALL be a hard
error, and an exemption for a requirement that does have Playwright coverage SHALL
be a hard error, so coverage arriving later forces the exemption out. Requirement
names therefore act as identifiers, and renaming a requirement SHALL break any
exemption citing it. Two entries naming the same requirement SHALL be a hard error
rather than one silently overriding the other, and an exemption for a requirement
whose every scenario is already scenario-exempt SHALL be a hard error, since such
a requirement needs no end-to-end decision to begin with.

#### Scenario: Exemption for an unknown requirement fails the run

- **WHEN** an end-to-end exemption names a requirement absent from the specs
- **THEN** the tool exits non-zero and names the offending entry

#### Scenario: Renaming a requirement breaks its exemption visibly

- **WHEN** a requirement is renamed while an end-to-end exemption still cites the
  old name
- **THEN** the tool exits non-zero and reports the old identifier

#### Scenario: Exemption superseded by end-to-end coverage fails the run

- **WHEN** a requirement is both end-to-end exempt and covered by a Playwright test
- **THEN** the tool exits non-zero and reports that the exemption must be removed

#### Scenario: Duplicate exemption entries for one requirement fail the run

- **WHEN** two end-to-end exemptions name the same requirement
- **THEN** the tool exits non-zero and names the duplicated requirement

#### Scenario: Exemption for a requirement needing no decision fails the run

- **GIVEN** a requirement whose every scenario carries a scenario exemption
- **WHEN** an end-to-end exemption also names that requirement
- **THEN** the tool exits non-zero and reports the exemption as unnecessary

### Requirement: Coverage map reports end-to-end coverage per requirement

The generated coverage map SHALL report end-to-end coverage as a distinct dimension:
per-capability counts of requirements with and without Playwright coverage, the list
of requirements lacking it, and for each exempt requirement its category and reason.

#### Scenario: Map counts end-to-end coverage per capability

- **WHEN** the coverage map is generated
- **THEN** it states, for each capability, how many of its requirements have
  end-to-end coverage and how many are exempt

#### Scenario: Map lists requirements without end-to-end coverage

- **WHEN** a requirement has neither Playwright coverage nor an exemption
- **THEN** the map lists it as lacking end-to-end coverage

#### Scenario: Map shows the category behind each exemption

- **WHEN** a requirement is end-to-end exempt
- **THEN** the map shows its category alongside the written reason

### Requirement: CI gates every requirement on end-to-end coverage

The existing strict check SHALL fail when any requirement has neither end-to-end
coverage nor an exemption, so a new requirement cannot merge without a browser test
or a stated decision. No additional CI step SHALL be required.

#### Scenario: Requirement without end-to-end coverage fails CI

- **WHEN** a change adds a requirement whose scenarios are covered only by unit
  tests, with no end-to-end exemption
- **THEN** the strict check exits non-zero and lists that requirement

#### Scenario: Existing CI step picks up the rule

- **WHEN** the strict check runs
- **THEN** it evaluates both scenario coverage and requirement-level end-to-end
  coverage, without a separate command or workflow step

## MODIFIED Requirements

### Requirement: Tests declare covered scenarios by annotation

A test SHALL declare the specification scenarios it covers with a
`// @scenario <capability>/<Scenario title>` comment placed immediately above the
test it applies to. The same syntax SHALL be used in both test layers (Jest under
`src/**/__tests__/` and Playwright under `e2e/`).

Consecutive annotation comment lines SHALL each declare a separate scenario, so one
test can cover many scenarios. An annotation placed above a `describe` or
`test.describe` block SHALL apply to every test within that block. A scenario MAY be
claimed by more than one test.

A test declared through a locally aliased import of the test function — for example
`import { test as setup } from '@playwright/test'` — SHALL be recognized as a test.
Failing to recognize an alias would make such tests silently uncoverable rather than
producing an error, which is the one outcome the tool exists to prevent.

#### Scenario: Annotation links a test to a scenario

- **WHEN** a test is preceded by `// @scenario time-clock/Clock in when idle`
- **THEN** the scenario `time-clock/Clock in when idle` is recorded as covered by
  that test

#### Scenario: Stacked annotations declare multiple scenarios

- **WHEN** several `// @scenario` lines appear consecutively above one test
- **THEN** each named scenario is recorded as covered by that test

#### Scenario: Suite-level annotation covers every test inside

- **WHEN** an annotation precedes a `describe` or `test.describe` block
- **THEN** every test inside that block is recorded as covering the named scenario

#### Scenario: Annotations work identically in both test layers

- **WHEN** annotations appear in a Jest test file and in a Playwright spec file
- **THEN** both are extracted by the same convention and appear in the coverage map

#### Scenario: Aliased test function is recognized

- **WHEN** a file imports the test function under a different local name and
  declares an annotated test with it
- **THEN** the annotation is resolved against that test rather than being dropped
