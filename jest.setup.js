import '@testing-library/jest-dom';
import '@testing-library/jest-dom/matchers';
import '@testing-library/jest-dom/jest-globals';

// jsdom doesn't define TextEncoder/TextDecoder, which the generated Prisma
// client's runtime references on load. Server-layer tests (repositories, auth)
// pull that module into the graph even when the Prisma client itself is mocked,
// so polyfill from Node's util to let those modules load.
import { TextEncoder, TextDecoder } from 'util';
if (typeof globalThis.TextEncoder === 'undefined') {
  globalThis.TextEncoder = TextEncoder;
}
if (typeof globalThis.TextDecoder === 'undefined') {
  globalThis.TextDecoder = TextDecoder;
}
