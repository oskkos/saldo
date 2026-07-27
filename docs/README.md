# Saldo documentation

## For developers

| Document                                     | Read it when                                                                                       |
| -------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| [Getting started](getting-started.md)        | Setting up locally — prerequisites, the Docker and non-Docker paths, environment variables, troubleshooting. |
| [Architecture](architecture.md)              | Before your first change. Layer boundaries, the directory map, the data model, and the conventions that cause wrong code if unknown. |
| [Testing](testing.md)                        | Writing or running tests. The two layers, coverage, and spec-to-test traceability.                     |
| [Contributing](CONTRIBUTING.md)              | Opening a pull request. Commit conventions, git hooks, and the OpenSpec workflow.                      |
| [`e2e/README.md`](../e2e/README.md)          | Working inside the Playwright suite — fixtures, seeding, and writing a date-agnostic test.             |
| [`CLAUDE.md`](../CLAUDE.md)                  | Working with Claude Code on this repository.                                                            |

## For users

The [user guide](https://oskkos.github.io/saldo/) is a task-oriented guide to using
Saldo, generated from the OpenSpec specs and published to GitHub Pages.
[`user-guide/README.md`](user-guide/README.md) explains how it is authored, built and
regenerated.

## Specifications

[`openspec/specs/`](../openspec/specs/) holds the canonical requirements and scenarios
for each capability — the behaviour the code is meant to have, and the source both the
test-coverage map and the user guide are generated from.
[`openspec/COVERAGE.md`](../openspec/COVERAGE.md) is that generated map.
