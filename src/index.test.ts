import { describe, it, expect } from 'vitest';
// Import from the package ENTRY POINT, not the internal module directly —
// an export that only the implementation file can see is exactly the
// defect this test exists to catch.
import * as entryPoint from './index';
import type { PlatformConfig } from './index';

describe('package entry point', () => {
  it('re-exports the platform-config surface: loadPlatformConfig, platformConfig', () => {
    expect(typeof entryPoint.loadPlatformConfig).toBe('function');
    expect(typeof entryPoint.platformConfig).toBe('function');
  });

  it('re-exports the existing app surface unchanged: Boogy, BoogyError', () => {
    expect(typeof entryPoint.Boogy).toBe('function');
    expect(typeof entryPoint.BoogyError).toBe('function');
  });

  it('re-exports the PlatformConfig type (compile-time check — see below)', () => {
    // `PlatformConfig` is a type, erased at runtime, so it cannot be asserted
    // on here directly. The real assertion is the `import type` above and the
    // annotation below: both fail `pnpm build` (tsc) if the entry point stops
    // exporting the type, which is the only failure mode that matters for a
    // type-only export.
    const sample: PlatformConfig = { authOrigin: 'https://auth.boogy.ai', owner: 'alice', shellOrigins: [] };
    expect(sample.owner).toBe('alice');
  });
});

describe('pane protocol surface', () => {
  it('exports the pane and board entry points and the protocol version', () => {
    expect(typeof entryPoint.connectPane).toBe('function');
    expect(typeof entryPoint.createShell).toBe('function');
    expect(entryPoint.PANE_PROTOCOL).toBe('pane/v1');
    expect(typeof entryPoint.MAX_TITLE_LENGTH).toBe('number');
  });

  // The version promise covers the entry points, not the helpers under them;
  // a later refactor must not widen the public API by accident.
  it('exports no internal helpers', () => {
    for (const name of ['parseFrame', 'sendFrame', 'receiveFrames', 'exactOrigin', 'isRestorablePath']) {
      expect(name in entryPoint).toBe(false);
    }
  });
});
