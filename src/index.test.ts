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

  it('exports the app-token pair for a service without a frontend', () => {
    expect(typeof entryPoint.requestAppToken).toBe('function');
    expect(typeof entryPoint.completeAppToken).toBe('function');
    expect(typeof entryPoint.appTokenSession).toBe('function');
    expect(entryPoint.SESSION_KEY_PREFIX).toBe('boogy.app-token.session.v1:');
    expect(entryPoint.REFRESH_SKEW_MS).toBe(60_000);
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
    const sample: PlatformConfig = { authOrigin: 'https://auth.boogy.ai', owner: 'alice', shellOrigins: [], boardShell: false };
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

  // A board frames and signs in apps by the same rules the platform's own page
  // at an app's address does: one frame sandbox, one cooldown between trips,
  // one cap on a trip. Each is one exported value, never a copy.
  it('exports the framing policy a board shares with the platform page', () => {
    expect(entryPoint.PANE_SANDBOX).toContain('allow-same-origin');
    expect(entryPoint.TRIP_COOLDOWN_MS).toBe(15_000);
    expect(entryPoint.MAX_SIGN_IN_PANES).toBe(32);
  });

  // One label-shape check, which every page uses before composing an origin
  // out of a label.
  it('exports the one label-shape check', () => {
    expect(entryPoint.isServiceLabel('notes-k3v9')).toBe(true);
    expect(entryPoint.isServiceLabel('boards')).toBe(false);
  });

  // The version promise covers the entry points, not the helpers under them;
  // a later refactor must not widen the public API by accident. A board's
  // translator between a page's two addresses is the board's own, not the
  // SDK's: only a board saved locations under a mount.
  it('exports no internal helpers', () => {
    for (const name of ['parseFrame', 'sendFrame', 'receiveFrames', 'exactOrigin', 'isRestorablePath', 'readablePath', 'appPath']) {
      expect(name in entryPoint).toBe(false);
    }
  });
});
