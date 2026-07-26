import * as Sentry from '@sentry/nextjs';

export function register() {
  Sentry.init({
    dsn: 'https://90938dbdebe9449ba724c76064799c25@o4505563922038784.ingest.sentry.io/4505563923218432',

    // Adjust this value in production, or use tracesSampler for greater control
    tracesSampleRate: 1,

    // Setting this option to true will print useful information to the console while you're setting up Sentry.
    debug: false,
  });

  registerCoverageFlush();
}

/**
 * Write the V8 coverage profile out when the end-to-end run tears the server down.
 *
 * Node writes a `NODE_V8_COVERAGE` profile on the normal exit path, and `next start`
 * does exit gracefully on SIGTERM — so this is not what makes collection work today.
 * It is here so that collection keeps working if Next's signal handling changes:
 * `takeCoverage()` is synchronous, so the profile is on disk before the process goes.
 *
 * Inert unless E2E_COVERAGE is set, so production installs no handlers.
 */
function registerCoverageFlush() {
  if (!process.env.E2E_COVERAGE || process.env.NEXT_RUNTIME !== 'nodejs') {
    return;
  }

  // Imported dynamically so the Edge runtime never has to resolve node:v8.
  void import('node:v8').then((v8) => {
    for (const signal of ['SIGTERM', 'SIGINT'] as const) {
      process.on(signal, () => {
        v8.takeCoverage();
        process.exit(0);
      });
    }
  });
}
