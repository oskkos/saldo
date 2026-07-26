## ADDED Requirements

### Requirement: End-to-end coverage is collected from both runtimes

The end-to-end coverage report SHALL include code executed in the application's server
process and code executed in the browser, merged per source file.

Both runtimes are required rather than preferred. Pages are async server components and
every mutation goes through a server action, so a browser-only profile would omit the
layers the end-to-end suite uniquely exercises — which is the reason for collecting
anything at all.

Collection SHALL cover every browser context the suite drives, including the
authentication setup that signs the shared test user in. A test file under `e2e/` that
declares tests without using the instrumented test fixture SHALL be reported as an
error, since it would otherwise drop out of collection silently.

#### Scenario: Server-executed code appears in the report

- **GIVEN** a server-side coverage profile recording execution in a project source file
- **WHEN** the end-to-end report is generated
- **THEN** that file appears in the report with the executed lines marked covered

#### Scenario: Browser-executed code appears in the report

- **GIVEN** a browser coverage profile recording execution in a project source file
- **WHEN** the end-to-end report is generated
- **THEN** that file appears in the report with the executed lines marked covered

#### Scenario: A file executed in both runtimes is reported once

- **GIVEN** both profiles record execution in the same source file, on different lines
- **WHEN** the end-to-end report is generated
- **THEN** the file appears as a single entry whose covered lines are the union of both

#### Scenario: A test file bypassing the instrumented fixture is rejected

- **WHEN** a file under `e2e/` declares tests but takes its test function directly from
  the test runner instead of the instrumented fixture
- **THEN** the check fails, naming that file

### Requirement: Collection is opt-in

Coverage collection SHALL be enabled by a single explicit switch and SHALL be off by
default. With the switch unset, an end-to-end run SHALL emit no source maps beyond the
build's own defaults, start no profiler, and write no coverage artifacts.

The switch exists because the cost is real — an extra build with source maps, profiler
overhead, and artifacts in the working tree — and because the everyday local run should
be exactly as fast as it was before this capability existed.

#### Scenario: The default end-to-end script enables nothing

- **WHEN** the end-to-end suite is run through its default script
- **THEN** the coverage switch is not set, and no coverage artifacts are produced

#### Scenario: A dedicated script enables collection

- **WHEN** the end-to-end suite is run through its coverage script
- **THEN** the switch is set for the application build, the server profiler and the
  browser collector together

#### Scenario: Source maps are emitted only under the switch

- **GIVEN** the application build configuration
- **WHEN** the switch is unset
- **THEN** the build emits no additional source maps, and enabling the switch turns them
  on for both the server and the browser

### Requirement: Report paths match the repository layout

Every source path in the generated report SHALL be repository-relative — matching the
form the unit report writes — and SHALL resolve to a file on disk. The report step SHALL
fail when a path does not resolve.

Bundlers name sources with their own prefixes, such as
`turbopack:///[project]/src/app/settings/page.tsx`. Per-file merging between the two
layers is string equality on the path, so an unnormalised prefix does not merge: the
report stays well-formed, the upload succeeds, and a second file tree appears beside the
real one. Checking against the filesystem is what makes that failure loud instead of
invisible.

#### Scenario: Bundler-prefixed source paths are normalised

- **GIVEN** a coverage profile whose source paths carry a bundler prefix
- **WHEN** the report is generated
- **THEN** each path is written repository-relative, in the same form the unit report
  uses

#### Scenario: A path that does not resolve fails the run

- **GIVEN** a normalised path that names no file on disk
- **WHEN** the report is generated
- **THEN** the step exits non-zero, naming the path

### Requirement: Report scope matches the unit layer

The end-to-end report SHALL cover the same source set as the unit report: project
sources under `src/`, excluding generated code. Bundled runtime code, dependencies and
framework internals SHALL be excluded.

Two reports over different source sets cannot be compared, and a tool merging them
produces a total describing neither.

#### Scenario: Only project sources are reported

- **GIVEN** a coverage profile that also records dependency and framework internals
- **WHEN** the report is generated
- **THEN** only sources under `src/` appear

#### Scenario: Generated code is excluded

- **GIVEN** a coverage profile recording execution in the generated database client
- **WHEN** the report is generated
- **THEN** those files do not appear, matching the unit report's exclusions

### Requirement: An empty or partial report fails the run

The report step SHALL exit non-zero when either runtime contributed no data, or when no
source file survives filtering.

This is the characteristic failure of profiling a process the test runner terminates:
the server writes its profile during shutdown, so a change in signal handling stops
collection without breaking anything visible. Left unguarded, the pipeline would publish
an empty report and the coverage service would carry the previous one forward
indefinitely — the number would stay plausible and stop being true.

#### Scenario: A missing server profile fails the run

- **WHEN** the report is generated and no server-side profile was written
- **THEN** the step exits non-zero, reporting which runtime is missing

#### Scenario: A missing browser profile fails the run

- **WHEN** the report is generated and no browser profile was written
- **THEN** the step exits non-zero, reporting which runtime is missing

#### Scenario: A report covering no source file fails the run

- **GIVEN** profiles that contain data, but none of it in project sources
- **WHEN** the report is generated
- **THEN** the step exits non-zero rather than writing an empty report

### Requirement: Each test layer is published under its own flag

Continuous integration SHALL publish unit coverage and end-to-end coverage as separate
flagged uploads, so the combined total counts both layers and each remains separately
visible. Flag configuration SHALL carry a layer's last known report forward when its job
does not run, so a job that did not report cannot be read as a layer covering nothing.

The end-to-end job SHALL generate the report before uploading it, and SHALL upload only
after a passing suite — a failed run's coverage is not a fact worth publishing.

#### Scenario: Unit coverage is published under its own flag

- **WHEN** the unit job uploads coverage
- **THEN** it is flagged as the unit layer

#### Scenario: End-to-end coverage is published under its own flag

- **WHEN** the end-to-end job uploads coverage
- **THEN** it is flagged as the end-to-end layer

#### Scenario: The end-to-end job reports before uploading

- **GIVEN** the end-to-end job's steps
- **WHEN** the workflow runs
- **THEN** the report is generated after the suite and before the upload

#### Scenario: A layer that did not run is carried forward

- **GIVEN** flag configuration for both layers
- **WHEN** one job does not run
- **THEN** that layer's previous report is carried forward rather than counted as zero
