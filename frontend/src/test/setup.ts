import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// RTL's automatic cleanup-after-each relies on detecting a global `afterEach`
// (as injected by `test.globals: true`); since globals are off here (test
// files import `afterEach` explicitly instead), register it manually so a
// component rendered in one test doesn't leak into the next.
afterEach(() => {
  cleanup();
});
