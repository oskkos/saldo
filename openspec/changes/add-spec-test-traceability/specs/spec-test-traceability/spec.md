## ADDED Requirements

### Requirement: Tests declare covered scenarios by annotation

A test SHALL declare the specification scenarios it covers with a
`// @scenario <capability>/<Scenario title>` comment placed immediately above the
test it applies to. The same syntax SHALL be used in both test layers (Jest under
`src/**/__tests__/` and Playwright under `e2e/`).

Consecutive annotation comment lines SHALL each declare a separate scenario, so one
test can cover many scenarios. An annotation placed above a `describe` or
`test.describe` block SHALL apply to every test within that block. A scenario MAY be
claimed by more than one test.

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
