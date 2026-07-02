## Why

Saldo has no end-user documentation, and hand-writing a guide would rot the moment
the UI or behavior changes. The OpenSpec specs already describe every capability's
behavior authoritatively and are kept in sync via the `opsx` workflow — so they can
serve as the source of truth for a generated, task-oriented user guide. Generating
it on demand keeps docs cheap to produce and easy to keep honest, with a human
reviewing every change through a normal PR.

## What Changes

- Add an on-demand Claude Code **skill** (`generate-user-guides`) that produces a
  task-oriented user guide from the canonical OpenSpec specs.
- The skill reads `openspec/specs/**`, infers each requirement's UI surface
  agentically (route + state, by reading `src/app/` and driving the running app),
  drives **Playwright** (MCP → Windows Edge) to capture screenshots, and writes
  Markdown pages grounded on those screenshots.
- Guide information architecture is **task-oriented** (user journeys), not a 1:1
  mirror of capabilities. Each page carries a **traceability footer** citing the
  capability + requirements it was generated from. Plumbing requirements (auth
  session gates, per-user ownership scoping, etc.) are deliberately excluded.
- A **requirement content-hash manifest** records which requirements each page was
  generated from. Runs are **stateful**: the skill reads the existing guide + the
  manifest and regenerates only the delta, keeping PR diffs small and reviewable.
- **Scoped runs**: the skill accepts a fuzzy scope argument (a page, capability, or
  requirement — or nothing for the manifest-driven delta) and a refresh mode
  (`prose`, `screenshots`, or `both`). This is the manual lever that compensates for
  the drift-detection deferred to v2: a pure-UI change is refreshed by naming its
  slice.
- A **status / dry-run mode** (`--check`) rehashes requirements against the manifest
  and reports staleness (which pages cite changed requirements, how old each page is)
  without touching the browser or writing files.
- New capabilities appearing in the specs get a **soft-default IA placement**: the
  skill picks a reasonable slot and the human corrects it in PR review — no blocking
  gate.
- Presentation via **mkdocs-material**; the nav is the one durable hand-blessed
  artifact.
- **Publishing:** a GitHub Actions workflow builds the site and deploys it to **GitHub
  Pages** on push to `develop` (path-filtered to `docs/user-guide/**`). Local
  `mkdocs serve` remains the authoring loop.
- **Output is committed Markdown + screenshots opened as a PR** — human-in-the-loop.
  The skill never merges.
- **Explicitly out of scope for v1** (deferred to v2, added together when automated
  drift detection has a real consumer): DB seeding, clock-freezing, and **pixelmatch**
  visual-diffing. v1 relies on a representative dev environment + date-agnostic prose
  instead of a reproducible capture harness.

## Capabilities

### New Capabilities
- `user-guide-generation`: Generating and maintaining a task-oriented end-user guide
  from the OpenSpec specs — IA rules, spec→UI inference, screenshot capture,
  traceability footers, the content-hash manifest, scoped/stateful regeneration, the
  status mode, and PR-based human review.

### Modified Capabilities
<!-- None. This change adds tooling that consumes existing specs; it does not alter any
     capability's runtime behavior or requirements. -->

## Impact

- **New skill** under the repo's Claude Code skills location (`SKILL.md` + `scripts/`
  for capture/manifest helpers + `templates/` for the page-with-footer and mkdocs nav).
- **New docs tree** (e.g. `docs/user-guide/`) holding generated Markdown, committed
  screenshots, the hash manifest, and `mkdocs.yml`.
- **New dev dependency**: mkdocs-material (Python toolchain) for building/serving the
  site. Playwright capture reuses the existing Playwright MCP setup (Windows Edge);
  no new app runtime dependency.
- **New CI workflow** `.github/workflows/docs.yml` deploying to **GitHub Pages**.
  Requires Pages enabled for the repo with **Source = GitHub Actions** (one-time repo
  setting) plus `pages: write` / `id-token: write` permissions on the job.
- **No changes** to `src/` runtime code, the Prisma schema, or any existing capability's
  behavior. The app is only *driven and read*, never modified, by the pipeline.
- Depends on a **representative dev environment** at capture time (an unenforced
  precondition in v1) and on prose being written date-agnostically so screenshot
  drift is harmless.
