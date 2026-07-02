---
name: generate-user-guides
description: Generate/update Saldo's task-oriented end-user guide from the OpenSpec specs — infer each user-facing requirement's UI, capture screenshots via the Playwright MCP, write Markdown with per-requirement traceability footers, and open a PR. Use when the user wants to (re)generate user documentation, refresh a guide page after a spec or UI change, or check guide staleness.
license: MIT
metadata:
  author: saldo
  version: "1.0"
---

Generate and maintain the Saldo **user guide** at `docs/user-guide/` from the canonical
OpenSpec specs. Output is committed Markdown + screenshots surfaced as a **PR for human
review** — this skill never merges. The specs are the source of truth; every guide claim
traces back to a requirement.

## Prerequisites (verify before doing anything else)

1. **Playwright MCP is available** (`mcp__plugin_playwright_playwright__browser_*` tools).
   Capture is MCP-driven — there is no standalone capture script, because WSL cannot
   launch Windows Edge; only the MCP server can. If the MCP is absent (e.g. a headless
   run), STOP and tell the user to run this interactively.
2. **The dev app is running** at `http://localhost:3000`. Check with
   `curl -s -o /dev/null -w "%{http_code}" http://localhost:3000` (302/307 = up, needs
   login). If it is down, ask the user to start it (`npm run dev`) — do not start it
   yourself unless they ask.
3. **The dev account holds representative, presentable data.** v1 has no seeding/clock
   freeze: screenshots reflect live state. If the calendar/statistics look empty or
   embarrassing, warn the user and pause — an empty screenshot is worse than none.

All script paths below are relative to this skill's `scripts/` directory. Run them with
`node`; they use Node builtins only.

## Arguments

`/generate-user-guides [scope] [--prose|--screenshots|--both] [--check]`

- **scope** (optional, fuzzy): a capability (`worklog`), a requirement name substring,
  or a page filename (`logging-a-work-day.md`). Omitted → the manifest **delta** (pages
  whose cited requirements changed). Resolve it with `resolve-scope.mjs`.
- **refresh mode** (optional, default `--both`): what to regenerate within the work set.
  - `--prose` — rewrite text only; do NOT re-capture screenshots.
  - `--screenshots` — re-capture screenshots only; leave prose. Use after a UI-only
    change (which the manifest cannot detect — this is the manual drift lever).
  - `--both` — rewrite prose and re-capture.
- **--check** — status/dry-run. Report staleness and STOP. Writes nothing, no browser.

## Modes

### `--check` (status / dry-run) — do this and stop

```
node scripts/check.mjs          # human report
node scripts/check.mjs --json   # machine summary (pagesToRegenerate, stale, orphaned, uncovered)
```

Relay the report. Interpret `uncovered` with judgment: a user-facing requirement cited
by no page is a **gap**; an internal/plumbing requirement being uncovered is **expected**
(see plumbing list below). Write nothing.

### Generation (default, or with a scope)

**Step 1 — Determine the work set.**
- No scope: `node scripts/resolve-scope.mjs` (delta) — pages whose cited requirement
  hashes moved, plus any page with a missing/invalid footer.
- With scope: `node scripts/resolve-scope.mjs "<scope>"`. If it prints nothing for a
  scope that should exist, the page may not exist yet → this is a NEW page (see IA).
- Cold/first run (empty guide): build the full page set from the IA below.

**Step 2 — Apply the information architecture (IA).** See "Information architecture".

**Step 3 — For each page in the work set** (unless mode is `--check`):
- Collect the requirements this page covers (from the IA mapping / existing footer).
- Get their current hashes: `node scripts/hash-requirements.mjs <capability> --json`.
- If mode includes screenshots: infer the UI and capture (see "Capture procedure").
- If mode includes prose: write/rewrite the page from `templates/page.md`, grounded on
  the screenshot, DATE-AGNOSTIC (never a specific date or the exact balance shown).
- Always (when writing prose) rewrite the traceability footer with the current hashes.

**Step 4 — Update the mkdocs nav** in `docs/user-guide/mkdocs.yml` for any new/renamed
pages (soft default — see IA). The nav is the one hand-blessed artifact.

**Step 5 — Build locally to verify** the site renders:
```
cd docs/user-guide && mkdocs build   # (in the venv from README.md)
```
If mkdocs isn't installed, note it and skip — don't block the guide on it.

**Step 6 — Output as a PR.** Stage `docs/user-guide/`, commit with a Conventional Commit
(`docs(user-guide): ...`), push a branch, and open a PR against `develop`. **Never merge.**
For a cold run, one PR covers the whole guide.

## Information architecture

The guide is **task-oriented** (user journeys), NOT a 1:1 mirror of capabilities. One
page may draw from several capabilities; one capability may feed several pages.

Default task pages (adjust as specs evolve):

| Page | Draws from (capabilities) |
| --- | --- |
| Signing in & your account | auth |
| Understanding your saldo | saldo (concept page — explanatory, few/no screenshots) |
| Logging a work day | worklog |
| Using the clock | time-clock, worklog |
| Recording an absence | absence, worklog |
| Account & expected hours | settings, expected-hours |
| Statistics | statistics |

**Exclude plumbing requirements** — internal behavior with no user-visible surface.
These MUST NOT become user instructions. Judge by whether a user could act on it; when
in doubt, exclude and let the `--check` `uncovered` list surface it for review. Typical
plumbing: session/auth gates ("Server-side auth gate", "JWT session with user id"),
per-user ownership scoping ("… only if owned", "scoped to the authenticated user"),
storage-mapping and server-action/validation internals, timezone-independence
guarantees.

**New capability with no page (soft default):** if the specs contain a user-facing
capability the IA doesn't cover, create a new page for it in a reasonable section, slot
it into the nav, and continue — do NOT block for approval. The human corrects placement
in PR review. If the new capability is plumbing, add no page.

## Capture procedure (Playwright MCP)

For consistency, before capturing: `browser_resize` to a fixed viewport (e.g. 1280×800).
Then per screen:

1. `browser_navigate` to the route (infer it by reading `src/app/**` — e.g. `/`,
   `/worklog-entry`, `/settings`, `/statistics`, `/absence`, `/worklog-items`).
2. `browser_snapshot` to confirm the expected state is on screen.
3. `browser_take_screenshot` (prefer a focused element/region when the whole page is
   noisy). The MCP writes into `.playwright-mcp/`.
4. Move/rename the PNG into `docs/user-guide/content/screenshots/` with a stable,
   page-derived name: `<page-slug>.png`, or `<page-slug>-<n>.png` for multiple shots
   on one page. Reference it from the page as `screenshots/<file>`.

Ground the prose on what the screenshot actually shows. Do not describe controls that
aren't visible. Keep every reference to dates/balances agnostic.

## Traceability footer (exact format — the scripts parse this)

End every generated page with, between the HTML-comment markers, a blockquote table of
`| Capability | Requirement | Hash |` rows — one per requirement the page covers, using
the current hash from `hash-requirements.mjs`:

```
<!-- traceability -->

> **Generated from OpenSpec specs** — do not hand-edit; run `/generate-user-guides` to update.
>
> | Capability | Requirement | Hash |
> | --- | --- | --- |
> | worklog | Create a worklog | `facc182bad45` |

<!-- /traceability -->
```

The footer IS the manifest — it is load-bearing. If it's malformed or missing, `check.mjs`
treats the page as "regenerate". Requirement names must match the spec headings exactly
(that's how hashes are keyed).

## Guardrails

- Specs are the source of truth; never invent behavior not in a requirement.
- Never document a plumbing requirement as a user step.
- Stateful by default: leave unchanged pages (and their screenshots) untouched.
- Never merge; stop at an open PR for human review.
- Keep prose date-agnostic so screenshot drift stays harmless.
