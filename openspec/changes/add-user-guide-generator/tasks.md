## 1. Docs tooling and scaffold

- [ ] 1.1 Add mkdocs-material tooling (Python requirements/config for local build+serve) without touching the app's Node runtime deps
- [ ] 1.2 Create the docs tree scaffold under `docs/user-guide/`: `mkdocs.yml`, the guide pages directory, a screenshots directory, and a placeholder nav
- [ ] 1.3 Add a short README documenting how to build/serve the site locally (local-only in this phase; no hosted deploy)

## 2. Manifest and helper scripts

- [ ] 2.1 Implement a hashing helper over `openspec/specs/**` that produces a per-requirement hash keyed by capability + requirement name (the values embedded in each page's footer)
- [ ] 2.2 Implement a "diff" helper that compares current requirement hashes against the manifest and returns the changed set (backs stateful delta regeneration and status mode)
- [ ] 2.3 Implement a reverse-index resolver: given a scope (page / capability / requirement), return the set of affected pages from the traceability footers
- [ ] 2.4 Implement a Playwright capture helper (driving the Playwright MCP → Windows Edge) that navigates to a route and writes a screenshot to a known path
- [ ] 2.5 Add page-with-footer and mkdocs-nav templates

## 3. The generate-user-guides skill

- [ ] 3.1 Scaffold the skill (`SKILL.md` + `scripts/` + `templates/`) at the repo's skills location with the chosen invocation name
- [ ] 3.2 Encode the IA policy: task-oriented pages, plumbing-exclusion rules, and soft-default placement for new capabilities
- [ ] 3.3 Encode the spec→UI inference + screenshot-grounded prose procedure, including date-agnostic phrasing
- [ ] 3.4 Encode stateful default runs (read guide + manifest, regenerate only the delta, leave unchanged pages and screenshots untouched)
- [ ] 3.5 Encode scoped runs: fuzzy scope argument + refresh mode (`prose` / `screenshots` / `both`), bounding both regeneration and recapture
- [ ] 3.6 Encode the status/dry-run (`--check`) mode: report staleness, write nothing, no browser
- [ ] 3.7 Encode the output step: commit generated Markdown + screenshots and open a PR; never merge

## 4. Cold run and verification

- [ ] 4.1 Ensure the dev environment holds representative (non-empty, presentable) data, then perform the initial cold run to generate the full guide
- [ ] 4.2 Verify each generated page against its traceability footer's cited requirements and confirm plumbing requirements produced no user-facing pages
- [ ] 4.3 Verify a scoped run and a `--check` status run behave per spec (scope limits blast radius; status writes nothing)
- [ ] 4.4 Build the mkdocs-material site locally and confirm nav + screenshots render, then open the guide PR for human review
