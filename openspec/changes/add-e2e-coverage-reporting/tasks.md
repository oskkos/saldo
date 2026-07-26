## 1. Prove the mechanism before building on it

No production code in this group. Its output is a recorded decision, committed with
group 2.

- [x] 1.1 Enable server and browser source maps behind `E2E_COVERAGE` in a scratch
      build and confirm the maps exist for server chunks — and that the Sentry plugin
      neither strips nor deletes them when no auth token is present
- [x] 1.2 Run the built app under `NODE_V8_COVERAGE`, exercise one page that renders a
      server component, convert the profile with `monocart-coverage-reports`, and
      confirm the lcov names real `src/**` files with plausible line hits
- [x] 1.3 Do the same for one browser profile captured through `page.coverage`, and
      confirm its paths land in the same repo-relative form
- [x] 1.4 Record the outcome in `design.md`: Turbopack maps resolve, or the e2e build
      falls back to `--webpack`. If neither resolves, stop — browser-only coverage does
      not ship under a name claiming both runtimes

## 2. Server-side collection

- [x] 2.1 Add `monocart-coverage-reports` as a devDependency
- [x] 2.2 Enable `productionBrowserSourceMaps` and `experimental.serverSourceMaps` in
      `next.config.js` under the switch, and turn Sentry's `hideSourceMaps` off with
      them so client bundles can find their own maps
- [x] 2.3 Write failing Jest tests for the config: with the switch unset the build emits
      no additional source maps, and with it set both server and browser maps are on
- [x] 2.4 Extend `src/instrumentation.ts` `register()` with an env-gated hook that
      installs `SIGTERM`/`SIGINT` handlers calling `v8.takeCoverage()` before exiting
      zero, so the profile survives Playwright terminating the server
- [x] 2.5 Add `NODE_V8_COVERAGE` to the Playwright web server env under the switch, and
      clear stale coverage artifacts in global setup so a previous run cannot inflate
      the next
- [x] 2.6 Ignore the coverage output directory in `.gitignore`

## 3. Browser-side collection

- [x] 3.1 Write a failing Jest test for the fixture guard: a file under `e2e/` that
      declares tests while taking its test function directly from the runner is
      reported as an error naming that file, and a file using the fixture is not
- [x] 3.2 Add `e2e/fixtures.ts` extending `test` with a `page` fixture that starts and
      stops `page.coverage`, writing one profile per test, and yields the page
      untouched when the switch is unset
- [x] 3.3 Re-point the seven `e2e/*.spec.ts` files and `auth.setup.ts` at the fixture,
      so the sign-in the suite performs on every run is collected too
- [x] 3.4 Implement the guard from 3.1

## 4. Report generation and its guards

- [ ] 4.1 Write failing tests over fixture profiles: a server profile puts its source
      file in the lcov, a browser profile does the same, and a file executed in both
      appears once with the union of covered lines
- [ ] 4.2 Write failing tests for paths: bundler-prefixed sources are normalised to the
      repo-relative form the Jest report uses, and a normalised path naming no file on
      disk fails the run
- [ ] 4.3 Write failing tests for scope: only sources under `src/` appear, and the
      generated Prisma client is excluded, matching Jest's `collectCoverageFrom`
- [ ] 4.4 Write failing tests for the emptiness guards: a missing server profile, a
      missing browser profile, and profiles yielding no project source each exit
      non-zero naming what is missing
- [ ] 4.5 Implement `scripts/e2e-coverage-report.mjs` to satisfy 4.1–4.4
- [ ] 4.6 Add `test:e2e:coverage` and the report script to `package.json`, and assert
      that the default `test:e2e` script sets no switch while the coverage one does

## 5. Publish each layer under its own flag

- [ ] 5.1 Write failing Jest tests reading `.github/workflows/build.yml` and
      `codecov.yml`: unit coverage uploads under the unit flag, end-to-end under the
      e2e flag, the report step sits between the suite and the upload, and both flags
      carry forward
- [ ] 5.2 Add `codecov.yml` declaring both flags with `carryforward: true` and a
      threshold, so a legitimate small dip does not fail a pull request
- [ ] 5.3 Wire the workflow: flag the existing upload, set the switch for the e2e job's
      build and run, add the report and flagged upload steps, and bump
      `codecov/codecov-action` to v5 while the step is being edited
- [ ] 5.4 Confirm 5.1 passes against the real files

## 6. Make the capability canonical and document it

- [ ] 6.1 Sync the delta into `openspec/specs/coverage-reporting/spec.md`, so the new
      requirements are canonical before the coverage gate has to pass
- [ ] 6.2 Annotate the new Jest tests with the `coverage-reporting` scenarios they
      assert
- [ ] 6.3 Add `no-ui` end-to-end exemptions for all six requirements — a CI script and
      a workflow have no user-visible surface
- [ ] 6.4 Regenerate `openspec/COVERAGE.md` and confirm every new scenario is covered
      and every new requirement decided
- [ ] 6.5 Document in `CLAUDE.md` and `e2e/README.md`: the opt-in script, what each
      flag measures, and that execution coverage is not assertion coverage —
      `spec-test-traceability` remains the answer to that question
- [ ] 6.6 Verify the branch tip is green: `npm run test:ci`, `npm run lint`,
      `npm run spec:coverage:ci`, `npm run test:e2e`, and one full
      `npm run test:e2e:coverage` producing a non-empty report whose paths all resolve
