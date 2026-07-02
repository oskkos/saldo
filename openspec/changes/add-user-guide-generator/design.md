## Context

Saldo has no end-user documentation. The OpenSpec specs (`openspec/specs/**`) are
authoritative, reverse-engineered behavioral descriptions of every capability, kept
current through the `opsx` workflow. They are written from the **system's** point of
view ("The system SHALL authenticate…"), include non-user-facing plumbing (session
gates, ownership scoping), and are organized by capability — none of which maps
cleanly onto what an end user wants to read.

The idea is to generate a task-oriented user guide from those specs with minimal
ongoing effort: Claude infers the UI surface, Playwright captures screenshots, and a
human reviews the result through a PR. This design records the decisions reached in
`/opsx:explore` before implementation.

## Goals / Non-Goals

**Goals:**

- Generate a task-oriented user guide from the canonical specs on demand.
- Keep regeneration cheap and PR diffs reviewable (stateful, delta-only).
- Make every guide claim auditable back to a specific requirement.
- Require the least durable hand-authored surface possible.
- Keep a human in the loop for every published change.

**Non-Goals:**

- **No reproducible capture harness in v1** — no DB seeding, no clock-freezing.
- **No pixel-level diffing (pixelmatch) in v1** — no automated visual-drift detection.
- Not altering any application runtime behavior; the app is only driven and read.
- Not a 1:1 capability-to-page mirror.
- Not auto-merging; the skill stops at opening a PR.

## Decisions

### D1 — Package as an on-demand Claude Code skill, not a deterministic script

The task mixes *judgment* (which requirements are user-facing, how to group them,
how to phrase instructions) with *mechanics* (navigate, capture, hash, write). A
skill is the right container: judgment lives in `SKILL.md` prose Claude follows;
mechanics live in helper `scripts/` the skill invokes so they don't drift with the
model's mood. This also dissolves the "Claude-infers-the-mapping is nondeterministic"
worry — a skill is an agentic invocation whose output a human reviews, so per-run
inference is the premise, not a bug.

*Alternative considered:* a fully deterministic generator/CI pipeline. Rejected —
it would need a hand-maintained spec→UI mapping and rigid templating, producing
generated-sludge prose and defeating the "minimal effort" goal.

### D2 — Task-oriented IA with per-page traceability footers (Option C)

Pages follow user journeys; each cites the capability + requirements it came from.
The footer is not decoration — it is a **bidirectional index** that (a) makes human
review tractable (reviewer checks the page against exactly the cited requirements),
(b) drives regeneration via reverse lookup (changed requirement → pages to regen),
and (c) yields undocumented-requirement and orphaned-claim detection for free.

*Alternatives:* capability-mirrored pages (mechanical but reads like an internal
manual; "Expected hours" as a top-level peer of "Auth" is meaningless to a user);
task-oriented without footers (useful but un-auditable and hard to regenerate
surgically).

### D3 — Claude infers the spec→UI mapping; no sidecar mapping files

Claude greps `src/app/` for routes, drives the running app, and grounds prose on the
captured screenshot. The committed screenshots + Markdown + manifest become the
*de-facto pinned mapping*; a bad inference is caught in PR review. This keeps the
durable hand-authored surface down to just the mkdocs nav.

### D4 — Content-hash manifest + stateful delta regeneration

The skill hashes each requirement a page cites and records it, so a default run
regenerates only pages whose cited requirements changed. This is kept in v1 not for
cost but for **diff hygiene** — regenerating all prose every run would make every PR a
wall of reworded paragraphs and destroy the review loop. Hashing is pure text, no
browser, effectively free.

The manifest is **realized as per-requirement hashes embedded directly in each page's
traceability footer** (keyed by capability + requirement name), not a separate sidecar
file. The footer already carries the citations (D2), so co-locating the hash keeps
source and provenance in one reviewable place — the footers collectively *are* the
manifest, and a page can never drift from its regeneration key.

### D5 — Scoped runs (fuzzy scope + refresh mode) as the manual drift lever

Deferring pixelmatch (D7) creates a blind spot: a UI-only change (spec unchanged) is
not auto-detected. The scope argument (page / capability / requirement / default) plus
refresh mode (`prose` / `screenshots` / `both`) is the manual compensating control —
name the slice, refresh its screenshots. All scopes resolve to a page-set through the
same footer reverse-index. Because it is a skill, the argument can be fuzzy natural
language; Claude resolves intent.

### D6 — Drop the capture harness from v1 (representative dev env + date-agnostic prose)

Reproducibility (seed + frozen clock) exists to feed a byte-level diff. With pixelmatch
deferred, that diff has no consumer, so the requirement collapses. What remains:
screenshots must be *representative* (don't photograph an empty app) and prose must be
*date-agnostic* so drift is harmless. Statefulness (D4) already prevents churn on
unchanged pages. This deletes the only piece of real engineering from v1.

*Trade accepted:* an **unenforced precondition** ("keep the dev account presentable")
replaces an enforced one (seeding). Fine for a solo project; the human reviewer is the
backstop.

### D7 — Defer pixelmatch, seeding, and clock-freeze together to v2

pixelmatch demands byte-identical frames, which for a date-centric app means seed +
frozen clock + pinned viewport + animations off + deterministic Chart.js — a whole
tranche of determinism work. Its only benefit over the human-in-the-loop reviewer is
*scale* (auto-targeting regen, catching drift a tired reviewer misses). Add all three
together the day the guide outgrows human eyeballing; when that day comes, prefer
Playwright's built-in `toHaveScreenshot` + region masking over hand-rolled pixelmatch.

### D8 — mkdocs-material for presentation; committed output; PR is the gate

The generated Markdown + screenshots live under **`docs/user-guide/`** and are surfaced
as a PR. mkdocs-material renders the site; its nav is the one durable hand-blessed
artifact (new capabilities get a soft-default slot per D2/proposal, corrected in review).
The **first phase builds/serves the site locally only** — no hosted deploy (e.g. GitHub
Pages) until the guide has proven itself. The **initial cold run lands as one PR** for
the whole guide; subsequent runs are deltas (D4).

## Risks / Trade-offs

- **Unrepresentative / empty dev state at capture time** → screenshots look broken.
  *Mitigation:* keep a presentable dev account; human reviewer catches empties in the PR;
  status mode surfaces staleness. Escalate to seeding (v2) if it recurs.
- **UI-only drift goes undetected** (no pixelmatch) → pages silently go stale.
  *Mitigation:* scoped `screenshots` runs (D5) + status/`--check` staleness report; this is
  a deliberate v1 limitation, not an oversight.
- **Claude hallucinates a step or misreads a screen** → wrong instructions.
  *Mitigation:* prose grounded on screenshots (D3), traceability footer scopes reviewer
  attention, PR gate (D8).
- **Prose instability across runs** → noisy, unreviewable diffs.
  *Mitigation:* stateful delta regeneration keyed on the hash manifest (D4).
- **Screenshots leak real dev-account data** → privacy.
  *Mitigation:* use throwaway/test data in the capture account; reviewer glances before merge.
- **First (cold) run or a re-baseline** rewrites everything → large PR.
  *Mitigation:* accepted as a one-time cost; subsequent runs are deltas.

## Migration Plan

Additive tooling only — no runtime migration, no rollback concern for `src/`.

1. Add mkdocs-material tooling and the docs tree scaffold (`mkdocs.yml`, nav, empty guide dir).
2. Build the helper scripts (manifest hashing, capture driver over the Playwright MCP, page/footer + nav templates).
3. Author `SKILL.md` encoding the IA rules, plumbing-exclusion policy, inference procedure, scoped/stateful behavior, and PR output.
4. Cold-run to generate the initial guide; land it via PR.
5. Thereafter invoke on demand (typically after `opsx:archive` syncs canonical specs), scoped as needed.

Rollback = delete the skill and docs tree; nothing in the app depends on them.

## Resolved Decisions

- **Invocation name** — the skill is invoked as `/generate-user-guides`.
- **Docs tree layout** — generated Markdown, screenshots, and `mkdocs.yml` live under
  `docs/user-guide/`.
- **Manifest format & hash granularity** — per-requirement hash keyed by capability +
  requirement name, embedded in each page's traceability footer (no sidecar). See D4.
- **mkdocs build/deploy target** — local-only build in the first phase; no hosted deploy.
- **Cold run** — lands as one PR covering the whole guide; later runs are deltas.

## Open Questions

- None outstanding. (Skill/`scripts/` directory location follows the repo's existing
  Claude Code skills convention.)
