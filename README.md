<div align="center">

<img src="public/img/saldo-with-text.png" alt="Saldo" width="360">

**Know exactly how far ahead — or behind — you are.**

<br>

[![Open Saldo](https://img.shields.io/badge/Open_Saldo-422AD5?style=for-the-badge&logo=vercel&logoColor=white)](https://saldo-worklog.vercel.app)
&nbsp;
[![User guide](https://img.shields.io/badge/User_guide-422AD5?style=for-the-badge&logo=materialformkdocs&logoColor=white)](https://oskkos.github.io/saldo/)
&nbsp;
[![Getting started](https://img.shields.io/badge/Getting_started-31343C?style=for-the-badge&logo=docker&logoColor=white)](docs/getting-started.md)

<br>

[![CI](https://github.com/oskkos/saldo/actions/workflows/build.yml/badge.svg)](https://github.com/oskkos/saldo/actions/workflows/build.yml)
[![Publish user guide](https://github.com/oskkos/saldo/actions/workflows/docs.yml/badge.svg)](https://github.com/oskkos/saldo/actions/workflows/docs.yml)
[![codecov](https://codecov.io/gh/oskkos/saldo/branch/develop/graph/badge.svg)](https://codecov.io/gh/oskkos/saldo)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

![Next.js](https://img.shields.io/badge/Next.js-16-000000?logo=nextdotjs&logoColor=white)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&logoColor=white)
![Prisma](https://img.shields.io/badge/Prisma-7-2D3748?logo=prisma&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?logo=postgresql&logoColor=white)

</div>

---

## What is Saldo?

Saldo tracks your working hours and keeps a single running balance — your **saldo** — between the hours you actually worked and the hours expected of you. Positive means you're ahead; negative means you owe time.

The balance counts forward from a begin date you choose, starting from an optional initial balance. Expected hours accrue only on working days, so weekends and public holidays never count against you. Worked hours count on any day you log them.

![The Saldo calendar view, with the saldo badge in the top bar and worked hours on individual days.](docs/user-guide/content/screenshots/understanding-your-saldo.png)

## Features

- **A running saldo badge** in the top bar, updated every time you record time — no report to run.
- **Log a work day** with start and end times, an optional lunch-break subtraction, and a comment.
- **Clock in and out** to time a session live instead of typing times, with a running timer and a clocked-in indicator visible from anywhere.
- **Record absences** over a single day or a date range — holiday, flex hours, sick leave, or other — each affecting the balance according to its reason.
- **Statistics** covering the same window as your saldo: totals, daily average, most and least hours, absences by reason, and a per-day chart.
- **Expected hours your way** — set a default per day, and override individual dates with special days for half-days and the like.
- **Sign in** with Google, GitHub, or email and password.

## Screenshots

|                                                                                                       |                                                                                           |
| ----------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| ![Logging a work day](docs/user-guide/content/screenshots/logging-a-work-day.png)<br>**Log a day**    | ![The clock](docs/user-guide/content/screenshots/using-the-clock.png)<br>**Clock in/out** |
| ![Recording an absence](docs/user-guide/content/screenshots/recording-an-absence.png)<br>**Absences** | ![Statistics](docs/user-guide/content/screenshots/statistics.png)<br>**Statistics**       |

## Quick start

```bash
docker compose up -d db   # Postgres on localhost:3006
./run-migrations.sh       # prisma migrate deploy
docker compose up         # app on http://localhost:3000
```

Running without Docker, the full environment variable list, and the non-local auth setup are in **[Getting started](docs/getting-started.md)**.

## Tech stack

|               |                                                                        |
| ------------- | ---------------------------------------------------------------------- |
| **Framework** | Next.js 16 (App Router, server-first) · React 19 · TypeScript (strict) |
| **Data**      | Prisma 7 + PostgreSQL via the `pg` adapter                             |
| **Auth**      | NextAuth 4 — Credentials, Google, GitHub (JWT sessions)                |
| **UI**        | Tailwind 4 + daisyUI · Chart.js · react-hook-form + Zod                |
| **Dates**     | dayjs (all math in UTC) · `date-holidays` for public holidays          |
| **Testing**   | Jest + Testing Library · Playwright · Codecov                          |
| **Ops**       | Sentry · Vercel                                                        |

## Development

| Command                 | What it does                                 |
| ----------------------- | -------------------------------------------- |
| `npm run dev`           | Dev server on port 3000                      |
| `npm run build`         | Production build                             |
| `npm run test:ci`       | Jest, single run with coverage               |
| `npm test`              | Jest in **watch mode** — does not exit       |
| `npm run test:e2e`      | Playwright end-to-end suite                  |
| `npm run lint`          | ESLint (`--max-warnings=0`) + Prettier check |
| `npm run lint:fix`      | ESLint `--fix` + Prettier `--write`          |
| `npm run spec:coverage` | Regenerate `openspec/COVERAGE.md`            |

Run a single Jest test with `npx jest src/services/__tests__/someFile.test.ts` (add `-t "name"` to filter). The e2e suite needs a one-time database and `.env.e2e` setup — see **[`e2e/README.md`](e2e/README.md)**.

Commits go through Husky: `lint-staged` on pre-commit, and commitlint enforcing [Conventional Commits](https://www.conventionalcommits.org/) on the message.

### Architecture

Data flows `page/component → action → repository → Prisma`, with pure business logic kept to the side:

- **`src/app/`** — App Router pages, async server components by default.
- **`src/actions/`** — the single `'use server'` module; every mutation validates with Zod, then delegates.
- **`src/repository/`** — `server-only` data access that enforces per-user ownership on every call.
- **`src/services/`** — pure, side-effect-free domain logic: the saldo calculation itself.

The conventions that are easy to trip over — branded date types, UTC-only date math, the generated Prisma client location — are documented in **[`CLAUDE.md`](CLAUDE.md)**.

## Testing & quality

Two test layers cover near-complementary halves of the codebase and report to Codecov under separate flags: Jest (`unit`) holds the services, repository, and util layers; Playwright (`e2e`) drives every page and component. Only the pair describes the whole, which is why both carry forward.

Beyond coverage, CI enforces **spec-to-test traceability**: every scenario in `openspec/specs/` must be claimed by a test or explicitly exempt, and every requirement needs at least one Playwright test or a categorised exemption. Tests declare what they cover inline:

```ts
// @scenario time-clock/Clock in when idle
it('records the session start', () => { ... })
```

The generated map lives in **[`openspec/COVERAGE.md`](openspec/COVERAGE.md)**.

## Documentation

- **[User guide](https://oskkos.github.io/saldo/)** — task-oriented guide for people using Saldo, generated from the specs.
- **[Getting started](docs/getting-started.md)** — full local setup and environment variables.
- **[`openspec/`](openspec/)** — capability specs and the change workflow.
- **[`CLAUDE.md`](CLAUDE.md)** — architecture, conventions, and the contribution workflow in detail.

## License

[MIT](LICENSE) © Oskari Kosonen
