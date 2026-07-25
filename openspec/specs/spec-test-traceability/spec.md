# spec-test-traceability Specification

## Purpose

The **spec-test-traceability** capability links every scenario in
`openspec/specs/` to the tests that assert it. Tests declare what they cover with
a `// @scenario <capability>/<Scenario title>` annotation, a dependency-free Node
script derives a committed coverage map at `openspec/COVERAGE.md`, and CI fails on
a scenario that has neither a test nor a written exemption.

The point is to answer two questions on any pull request without running anything:
which scenarios are actually tested, and did this change add a scenario without a
test.

A second dimension runs on top of the same annotations. Every *requirement* must
have at least one scenario covered in the Playwright layer, or a categorised
exemption saying why not — so a user-facing journey cannot ship proven only by unit
tests, and declining a browser test is a decision someone wrote down.

## Requirements

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

### Requirement: Annotations claim only asserted outcomes

A test SHALL claim a scenario only if it asserts that scenario's THEN outcome. This
rule is enforced by code review rather than by tooling, and SHALL be stated in the
repository's contributor guidance so the obligation is discoverable without reading
the spec.

#### Scenario: Over-claiming is a review defect

- **WHEN** a test annotates a scenario whose THEN outcome it does not assert
- **THEN** the annotation is treated as a defect to be corrected in review, not as
  valid coverage

### Requirement: Scenario identity is capability and title

A scenario SHALL be identified by `<capability>/<Scenario title>`, where the
capability is the directory name under `openspec/specs/` and the title is the text
of its `#### Scenario:` heading. The identifier SHALL NOT include the parent
requirement, so that moving a scenario between requirements does not break
annotations that cite it.

Two scenarios within one capability having the same title SHALL be a hard error, so
an identifier can never be ambiguous.

#### Scenario: Scenario resolved by capability and title

- **WHEN** the tool parses `openspec/specs/<capability>/spec.md`
- **THEN** each `#### Scenario:` heading yields the identifier
  `<capability>/<title>`, independent of which requirement contains it

#### Scenario: Duplicate titles in a capability are rejected

- **WHEN** two scenarios in the same capability share a title
- **THEN** the tool exits non-zero and names the conflicting capability and title

### Requirement: Scenario content hash surfaces wording drift

The tool SHALL compute, for each scenario, a content hash over that scenario's
WHEN/THEN body with whitespace normalized, rendered as the first 12 hexadecimal
characters of its SHA-256. The hash SHALL cover the scenario body only, excluding
the parent requirement's prose, so that editing a requirement's description does not
churn the hashes of the scenarios beneath it.

The hash SHALL be recorded in the generated coverage map and SHALL NOT be part of
the annotation, so that a reworded scenario appears as a changed hash in the map's
diff — alongside the tests to re-verify — instead of failing the build.

#### Scenario: Reworded scenario changes its hash

- **WHEN** a scenario's WHEN/THEN body is edited and the map is regenerated
- **THEN** that scenario's hash changes in the coverage map, on the row listing the
  tests that cover it

#### Scenario: Requirement prose edit leaves scenario hashes stable

- **WHEN** only a requirement's descriptive text changes
- **THEN** the hashes of the scenarios under it are unchanged

#### Scenario: Whitespace-only edit leaves the hash stable

- **WHEN** a scenario body is rewrapped or reindented without changing its wording
- **THEN** its hash is unchanged

### Requirement: Generated coverage map is a committed artifact

The tool SHALL generate a coverage map at `openspec/COVERAGE.md` and that file SHALL
be committed to the repository, so the current coverage state can be read without
running anything.

The map SHALL contain per-capability coverage counts, every scenario with its
content hash and the tests covering it, and the list of scenarios that have no test.
Exempt scenarios SHALL be listed with their stated reason and SHALL be distinguished
from both covered and uncovered ones.

Test references SHALL identify the file and the test title, so a reader can navigate
from a scenario to the tests asserting it.

#### Scenario: Map reports coverage per capability

- **WHEN** the coverage map is generated
- **THEN** it states, for each capability, how many of its scenarios are covered,
  exempt, and uncovered

#### Scenario: Map lists the tests covering each scenario

- **WHEN** a scenario is annotated by one or more tests
- **THEN** the map lists that scenario with its hash and the file and title of every
  test covering it

#### Scenario: Map lists uncovered scenarios

- **WHEN** a scenario has neither an annotation nor an exemption
- **THEN** the map lists it as uncovered

#### Scenario: Exempt scenarios are shown with their reason

- **WHEN** a scenario is exempt
- **THEN** the map shows it as exempt together with the reason recorded for it

### Requirement: Exemptions are declared as data with a reason

Scenarios that cannot be covered by an automated test SHALL be declared in
`scripts/spec-coverage.exemptions.json` as entries carrying the scenario identifier
and a written reason. An entry MAY use a capability-level wildcard
(`<capability>/*`) to exempt a whole capability.

An exemption SHALL count as resolving its scenario, so an exempt scenario is not
reported as a gap.

#### Scenario: Exempt scenario is not a gap

- **WHEN** an uncovered scenario has an exemption entry
- **THEN** the tool does not report it as uncovered and does not fail the build

#### Scenario: Wildcard exempts a whole capability

- **WHEN** an exemption entry names `<capability>/*`
- **THEN** every scenario in that capability is treated as exempt

### Requirement: Exemptions cannot rot

An exemption naming a scenario that does not exist SHALL be a hard error, so
exemptions cannot outlive the scenarios they were written for. An exemption for a
scenario that is also annotated by a test SHALL be a hard error, so coverage that
arrives later forces the exemption to be removed.

#### Scenario: Unknown exemption fails the run

- **WHEN** an exemption names a scenario absent from the specs
- **THEN** the tool exits non-zero and names the offending entry

#### Scenario: Exemption superseded by a real test fails the run

- **WHEN** a scenario is both exempt and annotated by a test
- **THEN** the tool exits non-zero and reports that the exemption must be removed

### Requirement: Dangling and malformed annotations fail loudly

The tool SHALL reject, with a non-zero exit and a `file:line` reference, any
annotation it cannot resolve into a `(scenario, test)` pair: an annotation citing a
scenario that does not exist in the specs, an annotation not followed by a test or
suite declaration, and an annotation whose test title is not a plain string literal.

Failing loudly rather than skipping SHALL be preferred, so a broken link is never
silently dropped from the coverage map.

#### Scenario: Annotation citing an unknown scenario fails the run

- **WHEN** a test annotates a scenario identifier that no spec defines
- **THEN** the tool exits non-zero and reports the file, line, and unknown
  identifier

#### Scenario: Renaming a scenario breaks its annotations visibly

- **WHEN** a scenario is renamed in the specs while a test still cites the old title
- **THEN** the tool exits non-zero and names the test file and line citing the old
  identifier

#### Scenario: Unattached annotation fails the run

- **WHEN** an annotation is not followed by a test or suite declaration
- **THEN** the tool exits non-zero and reports the file and line

#### Scenario: Non-literal test title fails the run

- **WHEN** an annotated test's title is a template literal or other non-literal
  expression
- **THEN** the tool exits non-zero and reports the file and line

### Requirement: Coverage tool runs in generate and check modes

The tool SHALL be invocable through two npm scripts: one that regenerates
`openspec/COVERAGE.md` in place, and one check mode that verifies without writing
any file.

Check mode SHALL exit non-zero when the committed coverage map differs from a fresh
generation, so the map cannot silently go stale, and its message SHALL name the
command that regenerates it.

#### Scenario: Generate mode writes the map

- **WHEN** the generate script is run
- **THEN** `openspec/COVERAGE.md` is rewritten to reflect the current specs,
  annotations, and exemptions

#### Scenario: Check mode does not write

- **WHEN** the check script is run
- **THEN** no file is written, whether or not the check passes

#### Scenario: Stale committed map fails the check

- **WHEN** the committed coverage map differs from what a fresh generation produces
- **THEN** check mode exits non-zero and names the command that regenerates it

### Requirement: CI gates every scenario on coverage

The repository's CI SHALL run the coverage tool in check mode as a step of the
existing build-and-test job. The step SHALL NOT require a database or a browser.

CI SHALL fail when any scenario is neither covered nor exempt, so a new scenario
cannot merge without a test or a stated reason.

#### Scenario: Uncovered scenario fails CI

- **WHEN** a change adds a scenario with no annotating test and no exemption
- **THEN** the CI step exits non-zero and lists the uncovered scenario

#### Scenario: Coverage step needs no database or browser

- **WHEN** the CI coverage step runs
- **THEN** it completes using only the checked-out repository, without starting a
  database or a browser

### Requirement: Coverage tooling adds no dependencies

The tool SHALL be implemented as a plain ESM Node script using only the Node
standard library, requiring no new package dependency and no build step, and SHALL
run on the Node version used by CI.

#### Scenario: Tool runs without installing anything new

- **WHEN** the coverage tool is run on a checkout with the existing dependencies
  installed
- **THEN** it executes directly under Node with no additional package and no
  compilation step

### Requirement: Generated map is the single traceability source

The generated coverage map SHALL be the only maintained scenario-to-test
traceability record in the repository. Hand-maintained traceability tables SHALL be
replaced by a reference to the generated map, so the two cannot disagree.

#### Scenario: Hand-maintained table replaced by a pointer

- **WHEN** documentation needs to state which tests cover which scenarios
- **THEN** it points at the generated coverage map rather than restating the mapping

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
exemption citing it.

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
