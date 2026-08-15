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

// jsdom implements <dialog> as an element but not its modal behaviour, so
// `showModal`/`close` are missing. Components reach for both (src/components/
// modal.tsx), and a dialog that never opens or closes cannot be asserted on.
// Track the open state the way the real element does, so `open` reflects it.
if (typeof globalThis.HTMLDialogElement !== 'undefined') {
  const proto = globalThis.HTMLDialogElement.prototype;
  if (typeof proto.showModal !== 'function') {
    proto.showModal = function showModal() {
      this.open = true;
    };
  }
  if (typeof proto.close !== 'function') {
    proto.close = function close() {
      this.open = false;
      this.dispatchEvent(new Event('close'));
    };
  }
}
