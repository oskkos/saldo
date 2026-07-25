// Empty module. Mapped in jest.config.mjs for `server-only`, whose real entry
// throws when loaded outside a React Server Component bundle. Server-layer code
// (repositories, auth) imports 'server-only' as a build-time guard; under Jest
// (jsdom) that guard must resolve to a no-op so the modules can be unit-tested.
export {};
