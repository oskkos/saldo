## 1. Docs tooling and scaffold

- [x] 1.1 Add mkdocs-material tooling (Python requirements/config for local build+serve) without touching the app's Node runtime deps
- [x] 1.2 Create the docs tree scaffold under `docs/user-guide/`: `mkdocs.yml`, the guide pages directory, a screenshots directory, and a placeholder nav
- [x] 1.3 Add a short README documenting how to build/serve the site locally (local-only in this phase; no hosted deploy)

## 2. Manifest and helper scripts

- [x] 2.1 Implement a hashing helper over `openspec/specs/**` that produces a per-requirement hash keyed by capability + requirement name (the values embedded in each page's footer) — `scripts/hash-requirements.mjs`
- [x] 2.2 Implement a "diff" helper that compares current requirement hashes against the manifest and returns the changed set (backs stateful delta regeneration and status mode) — `scripts/check.mjs`
- [x] 2.3 Implement a reverse-index resolver: given a scope (page / capability / requirement), return the set of affected pages from the traceability footers — `scripts/resolve-scope.mjs`
- [x] 2.4 Document the Playwright-MCP capture procedure + screenshot path/naming convention in `SKILL.md` (no standalone script — WSL cannot launch Windows Edge; capture is MCP-driven by Claude). Completed with group 3.
- [x] 2.5 Add page-with-footer and mkdocs-nav templates — `templates/page.md`

## 3. The generate-user-guides skill

- [x] 3.1 Scaffold the skill (`SKILL.md` + `scripts/` + `templates/`) at the repo's skills location with the chosen invocation name
- [x] 3.2 Encode the IA policy: task-oriented pages, plumbing-exclusion rules, and soft-default placement for new capabilities
- [x] 3.3 Encode the spec→UI inference + screenshot-grounded prose procedure, including date-agnostic phrasing
- [x] 3.4 Encode stateful default runs (read guide + manifest, regenerate only the delta, leave unchanged pages and screenshots untouched)
- [x] 3.5 Encode scoped runs: fuzzy scope argument + refresh mode (`prose` / `screenshots` / `both`), bounding both regeneration and recapture
- [x] 3.6 Encode the status/dry-run (`--check`) mode: report staleness, write nothing, no browser
- [x] 3.7 Encode the output step: commit generated Markdown + screenshots and open a PR; never merge

## 4. Cold run and verification

- [x] 4.1 Ensure the dev environment holds representative (non-empty, presentable) data, then perform the initial cold run to generate the full guide (7 task pages captured against live dev data)
- [x] 4.2 Verify each generated page against its traceability footer's cited requirements and confirm plumbing requirements produced no user-facing pages (`check.mjs`: 0 stale/orphaned/no-footer; 22 uncovered = plumbing + out-of-scope "All worklogs" page)
- [x] 4.3 Verify a scoped run and a `--check` status run behave per spec (scope limits blast radius; status writes nothing) — verified during smoke test + cold run
- [x] 4.4 Build the mkdocs-material site locally and confirm nav + screenshots render, then open the guide PR for human review — built in venv; verified via served render (purple #422ad5 header, logo, stripped footers, nav); PR opens after user OK per workflow

## 5. Publish to GitHub Pages (CI)

- [x] 5.1 Add `.github/workflows/docs.yml` that builds the mkdocs site and deploys to GitHub Pages on push to `develop`, path-filtered to `docs/user-guide/**`
- [ ] 5.2 Enable GitHub Pages for the repo with Source = GitHub Actions (one-time repo setting — user action)
- [ ] 5.3 Confirm the first deployment succeeds and the published site matches the local render (after merge to `develop`)
