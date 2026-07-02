# user-guide-generation Specification

## Purpose
TBD - created by archiving change add-user-guide-generator. Update Purpose after archive.
## Requirements
### Requirement: Guide generated from canonical specs

The skill SHALL treat `openspec/specs/**` as the single source of truth for the
user guide's content, and SHALL read the canonical (post-sync) specs rather than
any change's delta specs. Guide claims SHALL be traceable to a requirement in
those specs.

#### Scenario: Content derives from canonical specs

- **WHEN** the skill generates or regenerates any guide page
- **THEN** every substantive claim on that page is derived from a requirement in
  `openspec/specs/**` and not invented from outside the specs

#### Scenario: Delta specs are ignored

- **WHEN** an in-flight change under `openspec/changes/` contains delta specs
- **THEN** the skill does not use those deltas as source, and reads only the
  canonical specs

### Requirement: Task-oriented information architecture

The guide's information architecture SHALL be organized around user tasks and
journeys, not as a one-to-one mirror of OpenSpec capabilities. A single guide page
MAY draw from requirements across multiple capabilities, and multiple pages MAY
draw from a single capability.

#### Scenario: A task page spans multiple capabilities

- **WHEN** a user task is served by requirements from more than one capability
- **THEN** the skill produces one task page covering that journey, drawing from
  all relevant capabilities

### Requirement: Plumbing requirements are excluded

The skill SHALL exclude requirements that describe internal, non-user-facing
behavior (for example session gating, per-user ownership scoping, JWT/session
mechanics) from the user guide.

#### Scenario: Internal requirement produces no user-facing content

- **WHEN** a requirement describes system-internal behavior with no user-visible
  surface
- **THEN** no guide page presents that requirement as a user instruction

### Requirement: Per-page traceability footer

Every generated guide page SHALL carry a traceability footer identifying the
capability and requirements it was generated from. The footer SHALL form a
reverse index usable to resolve which pages depend on a given requirement.

#### Scenario: Footer cites source requirements

- **WHEN** a guide page is generated
- **THEN** it ends with a footer listing the capability and the specific
  requirements the page was generated from

#### Scenario: Reverse lookup from requirement to pages

- **WHEN** the skill needs the set of pages affected by a given requirement
- **THEN** it resolves that set from the pages' traceability footers

### Requirement: Spec-to-UI inference grounded on screenshots

The skill SHALL infer each user-facing requirement's UI surface (route and
state) agentically — by reading the application routes and driving the running
app — and SHALL capture screenshots with Playwright. Prose describing the UI
SHALL be grounded on the captured screenshot rather than assumed.

#### Scenario: UI described from a captured screenshot

- **WHEN** a page documents a user-facing screen
- **THEN** the skill captures that screen with Playwright and the prose reflects
  what the screenshot actually shows

### Requirement: Date-agnostic prose

Generated prose SHALL refer to dates and running values in a date-agnostic way
(for example "the current day" rather than a specific date), because v1 captures
against a representative dev environment without a frozen clock, so that
screenshot drift over time does not invalidate the text.

#### Scenario: Prose avoids hardcoded dates

- **WHEN** prose refers to a day, month, or running balance shown in a screenshot
- **THEN** it uses a relative/agnostic description rather than the specific value
  visible at capture time

### Requirement: Requirement content-hash manifest

The skill SHALL maintain a manifest recording, per page, a content hash of each
requirement the page was generated from. The manifest SHALL be persisted alongside
the generated guide.

#### Scenario: Manifest records generation inputs

- **WHEN** a page is generated or regenerated
- **THEN** the manifest is updated with the current content hash of each
  requirement that page cites

### Requirement: Stateful delta regeneration

A default run SHALL be stateful: the skill SHALL read the existing guide and
manifest, compare current requirement hashes against the manifest, and regenerate
only pages whose cited requirements changed. Pages whose cited requirements are
unchanged SHALL be left untouched, including their committed screenshots.

#### Scenario: Only changed pages are regenerated

- **GIVEN** a manifest from a previous run
- **WHEN** the skill runs with no scope argument and one requirement's content has
  changed
- **THEN** only pages citing that requirement are regenerated and all other pages
  and screenshots are left unchanged

#### Scenario: No changes produces no output

- **WHEN** the skill runs with no scope and no cited requirement has changed
- **THEN** no page or screenshot is rewritten

### Requirement: Scoped runs with refresh mode

The skill SHALL accept an optional scope argument identifying a page, capability,
or requirement, and an optional refresh mode of `prose`, `screenshots`, or `both`.
When a scope is given, the skill SHALL limit both regeneration and screenshot
recapture to the pages resolved from that scope. This provides the manual lever to
refresh a page after a UI-only change that the manifest cannot detect.

#### Scenario: Scope limits the blast radius

- **WHEN** the skill runs with a scope naming a single capability
- **THEN** only pages resolved from that capability are affected, and the rest of
  the guide is untouched

#### Scenario: Refresh mode limits what is regenerated

- **WHEN** the skill runs with refresh mode `screenshots` for a scope
- **THEN** it recaptures screenshots for the resolved pages without rewriting their
  prose

### Requirement: Status mode reports staleness without writing

The skill SHALL provide a status/dry-run mode that rehashes requirements against
the manifest and reports which pages cite changed requirements and how stale each
page is, WITHOUT driving the browser or writing any file.

#### Scenario: Status mode is read-only

- **WHEN** the skill runs in status mode
- **THEN** it reports staleness information and neither captures screenshots nor
  writes any guide file or manifest entry

### Requirement: Soft-default placement for new capabilities

The skill SHALL place a capability that the current information architecture does
not cover into a reasonable default slot and proceed, rather than blocking.
Correction of the placement SHALL be left to human PR review.

#### Scenario: New capability slotted without blocking

- **WHEN** the specs contain a user-facing capability not represented in the guide
- **THEN** the skill generates a page for it in a default location and continues
  without requiring pre-approval of the placement

### Requirement: Human-in-the-loop output via PR

The skill SHALL write generated Markdown and screenshots into the committed docs
tree and surface the result as a pull request for human review. The skill SHALL
NOT merge its own output.

#### Scenario: Output is a reviewable PR

- **WHEN** a generation run completes with changes
- **THEN** the changes are committed to the docs tree and opened as a PR, and the
  skill does not merge it

### Requirement: Published to GitHub Pages via CI

The user guide SHALL be built and deployed to GitHub Pages by a CI workflow on push to
the default branch, triggered only when the guide sources under `docs/user-guide/**`
change. The published site SHALL be built with the same mkdocs configuration used
locally, so the rendered output (stripped footers, branding) matches.

#### Scenario: Guide changes trigger a publish

- **WHEN** a change under `docs/user-guide/**` is pushed to the default branch
- **THEN** CI builds the mkdocs site and deploys it to GitHub Pages

#### Scenario: Unrelated changes do not publish

- **WHEN** a push touches no files under `docs/user-guide/**`
- **THEN** the publish workflow does not run

### Requirement: No capture harness in v1

v1 SHALL NOT depend on database seeding or clock-freezing to produce screenshots,
and SHALL NOT perform pixel-level screenshot diffing. It SHALL instead rely on a
representative dev environment and date-agnostic prose.

#### Scenario: Generation runs without seeding or clock control

- **WHEN** the skill captures screenshots
- **THEN** it captures against the running dev environment as-is, without seeding a
  known state, freezing the clock, or diffing pixels

