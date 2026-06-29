import nextJest from 'next/jest.js';

// Pin tests to a fixed non-UTC timezone so any reliance on the runtime's local
// timezone (instead of UTC) is caught. Set before workers spawn so they inherit
// it (a runtime process.env.TZ change has no effect — Node caches the zone at
// startup). The date utilities are timezone-independent, so this is safe.
// Defaults to a non-UTC zone (CI leaves TZ unset); an explicit TZ override is
// honored, e.g. `TZ=UTC npm run test:ci` to confirm production-invariance.
process.env.TZ = process.env.TZ || 'America/New_York';

const createJestConfig = nextJest({
  // Provide the path to your Next.js app to load next.config.js and .env files in your test environment
  dir: './',
});

// Add any custom config to be passed to Jest
/** @type {import('jest').Config} */
const config = {
  // Add more setup options before each test is run
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],

  testEnvironment: 'jest-environment-jsdom',

  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },

  collectCoverageFrom: ['src/**/*.{ts,tsx}'],
};

// createJestConfig is exported this way to ensure that next/jest can load the Next.js config which is async
export default createJestConfig(config);
