# Contributing

Start with [Getting started](getting-started.md) for a working local setup, and
[Architecture](architecture.md) for the layer boundaries — most review comments on
this repository are about a layer being skipped.

## Before you open a pull request

```bash
npm run lint            # ESLint (--max-warnings=0) + Prettier check
npm run test:ci         # Jest
npm run test:e2e        # Playwright, if you touched anything user-visible
npm run spec:coverage   # regenerate openspec/COVERAGE.md if specs or annotations moved
npm run build           # only build failures are worth catching this way
```

CI runs lint, Prettier, `spec:coverage:ci`, and Jest on every push and pull request.
The branch tip has to be green; intermediate commits do not.

## Branches and commits

Branch off a freshly fetched `develop`, and open the pull request against `develop`.

```bash
git fetch origin develop
git checkout -b feat/short-description origin/develop
```

**Commit messages follow [Conventional Commits](https://www.conventionalcommits.org/),
enforced by commitlint** on the `commit-msg` hook. A non-conforming message is rejected
outright, so it is worth getting right the first time. The types in use here:

| Type       | For                                                    |
| ---------- | ------------------------------------------------------ |
| `feat`     | New user-visible behaviour                             |
| `fix`      | A bug fix                                              |
| `refactor` | Restructuring with no behaviour change                 |
| `test`     | Tests only                                             |
| `docs`     | Documentation, including everything under `openspec/`  |
| `chore`    | Tooling, dependencies, config                          |

Scope them to the area touched: `fix(absence): …`, `docs(openspec): …`,
`feat(worklog): …`.

### Git hooks

Husky installs two, via `prepare`:

- **`pre-commit`** runs `lint-staged`, which formats staged `*.{js,jsx,ts,tsx}` files
  with Prettier. It does not run ESLint — `.lintstagedrc.js` declares the same glob key
  twice and the Prettier entry overwrites the ESLint one. Run `npm run lint` yourself
  before pushing; the hook will not catch a lint error for you.
- **`commit-msg`** runs commitlint.

Markdown is not touched by either hook, and `openspec/` is in `.prettierignore`, so
spec and documentation files are never reformatted underneath you.

## The OpenSpec workflow

Behaviour is specified before it is built. `openspec/specs/<capability>/spec.md` holds
the canonical requirements and scenarios for each capability; a change proposal is a
folder under `openspec/changes/` containing `proposal.md`, `design.md` and `tasks.md`,
which is archived once the work lands.

The pipeline is **explore → propose → apply → archive**, one pull request per change.
The `/opsx:*` Claude Code commands generate the artifacts; git is driven separately.

| Stage       | What happens                                                                                                                                    |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| **explore** | Thinking and investigation. Nothing is written, nothing is committed.                                                                             |
| **propose** | Branch off fresh `develop`, generate the artifacts, commit as `docs(openspec): propose <change-name>`, push, and open the pull request.            |
| **apply**   | Implement it, one commit per top-level task group in `tasks.md`. Finish with the spec sync (below) in its own commit.                              |
| **archive** | Once CI is green and review is addressed — while the pull request is still open — `mv` the change folder to `changes/archive/YYYY-MM-DD-<name>`.   |

### Syncing specs at the end of apply, not at archive

The last commit of the apply stage applies the change's spec deltas to
`openspec/specs/`, together with a regenerated `openspec/COVERAGE.md`:

```
docs(openspec): sync <capability> spec(s) for <change-name>
```

This cannot wait for archiving. `scripts/spec-coverage.mjs` reads only
`openspec/specs/`, so a change that adds scenarios leaves every annotation citing them
unresolvable — and CI's `spec:coverage:ci` step red — until the delta reaches the
canonical specs. Archiving is meant to happen on green CI, so the sync has to come
first.

Two things the sync does not do for you:

- **Open Questions the change resolves must be removed by hand.** The delta format has
  no operation for them, and a resolved question left in the canonical spec is a false
  statement. Check every capability the change touches, not only the ones with a delta.
- **The archive commit stays on its own.** Keep the `mv` isolated from implementation
  commits so it renders as a rename and reverts as a unit.

## Adding behaviour: the checklist

A new requirement is not finished when the code works.

1. **Spec it** — requirement and scenarios in the change's delta, then synced into
   `openspec/specs/`.
2. **Test it** — Jest for the rules, Playwright for the journey. Every scenario needs a
   test or an exemption, and every requirement needs a Playwright test or a categorised
   one. [Testing](testing.md#spec-to-test-traceability) has the rules and the four
   exemption categories.
3. **Annotate it** — `// @scenario <capability>/<scenario name>` above the test, and
   only if the test asserts that scenario's THEN. Nothing can catch an over-claim
   automatically; it is a review check.
4. **Regenerate** — `npm run spec:coverage`, and commit `openspec/COVERAGE.md`.
5. **Document it** — see below.

## Keeping the documentation true

Two sets of docs go stale in different ways.

**Developer docs** — this folder, plus `CLAUDE.md`, [`e2e/README.md`](../e2e/README.md)
and the root `README.md`. Hand-written, so nothing detects the drift. If your change
alters a command, an environment variable, a layer boundary, the data model, or how
tests are run, update the page that describes it in the same pull request.

**The user guide** — `docs/user-guide/`, generated from the OpenSpec specs by the
`/generate-user-guides` skill and published to
[GitHub Pages](https://oskkos.github.io/saldo/) on push to `develop`. Do not hand-edit
the generated pages; the traceability footers record which requirement hash each page
was built from, and `--check` reports staleness against it.

```
/generate-user-guides            # regenerate only what changed
/generate-user-guides worklog    # scope to a capability, page, or requirement
/generate-user-guides --check    # staleness report, writes nothing
```

[`docs/user-guide/README.md`](user-guide/README.md) covers the layout, the mkdocs
toolchain, and how to serve the site locally.
