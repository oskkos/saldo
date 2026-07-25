import path from 'node:path';

// Where the authenticated session (storageState) is persisted by auth.setup.ts
// and reused by the chromium project. Kept in a non-test module so both the
// Playwright config and the setup file can import it without the config pulling
// a test file into scope.
export const STORAGE_STATE = path.join(__dirname, '.auth', 'user.json');
