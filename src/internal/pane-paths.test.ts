import { describe, it, expect } from 'vitest';
import { isRestorablePath } from './pane-paths';

describe('isRestorablePath', () => {
  it('accepts a path under the mount', () => {
    expect(isRestorablePath('/squad/rooms/42', '/squad')).toBe(true);
    expect(isRestorablePath('/squad', '/squad')).toBe(true);
    expect(isRestorablePath('/squad/', '/squad')).toBe(true);
    expect(isRestorablePath('/squad/rooms?tab=2#end', '/squad')).toBe(true);
  });

  it('refuses an absolute URL — the open-redirect case', () => {
    expect(isRestorablePath('https://evil.example/x', '/squad')).toBe(false);
    expect(isRestorablePath('//evil.example/x', '/squad')).toBe(false);
  });

  // A browser reads `/\host` as scheme-relative, exactly like `//host`.
  it('refuses a backslash, which a browser treats as another host', () => {
    expect(isRestorablePath('/\\evil.example/x', '/squad')).toBe(false);
    expect(isRestorablePath('/squad\\..\\other', '/squad')).toBe(false);
  });

  it('refuses a path outside the mount', () => {
    expect(isRestorablePath('/other/thing', '/squad')).toBe(false);
    // A prefix match is not a path match: /squadron is not under /squad.
    expect(isRestorablePath('/squadron/x', '/squad')).toBe(false);
  });

  it('refuses traversal, including the encoded dots a browser resolves', () => {
    expect(isRestorablePath('/squad/../other', '/squad')).toBe(false);
    expect(isRestorablePath('/squad/%2e%2e/other', '/squad')).toBe(false);
    expect(isRestorablePath('/squad/%2E%2e/other', '/squad')).toBe(false);
  });

  it('refuses non-paths and characters a URL parser silently drops', () => {
    expect(isRestorablePath('squad/x', '/squad')).toBe(false);
    expect(isRestorablePath('', '/squad')).toBe(false);
    expect(isRestorablePath('/\t/evil.example', '/squad')).toBe(false);
    expect(isRestorablePath('/squad/x\ny', '/squad')).toBe(false);
  });

  it('a module mounted at the root accepts its own paths and still refuses another host', () => {
    expect(isRestorablePath('/rooms/42', '/')).toBe(true);
    expect(isRestorablePath('/', '/')).toBe(true);
    expect(isRestorablePath('//evil.example', '/')).toBe(false);
    expect(isRestorablePath('/\\evil.example/x', '/')).toBe(false);
  });

  // The board's own server caps a saved location at 2048 characters; a longer
  // one would be refused on every save.
  it('refuses a path longer than a saved location may be', () => {
    expect(isRestorablePath(`/squad/${'x'.repeat(2048)}`, '/squad')).toBe(false);
    expect(isRestorablePath(`/squad/${'x'.repeat(100)}`, '/squad')).toBe(true);
  });
});
