import { describe, expect, it } from '@jest/globals';

import manifest from '../manifest';

// The webmanifest is what makes the app installable, and nothing else reads it — a
// typo in start_url or a missing icon would only show up on someone's home screen.

describe('manifest', () => {
  it('describes an installable app', () => {
    const { name, start_url, display, icons } = manifest();

    expect(name).toBe('saldo');
    expect(start_url).toBe('/');
    expect(display).toBe('standalone');
    expect(icons).toHaveLength(1);
  });
});
