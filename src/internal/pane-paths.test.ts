import { describe, it, expect } from 'vitest';
import { isRestorablePath } from './pane-paths';

describe('isRestorablePath', () => {
  it('accepts a plain path on the app own address', () => {
    expect(isRestorablePath('/rooms/42')).toBe(true);
    expect(isRestorablePath('/')).toBe(true);
    expect(isRestorablePath('/squad/')).toBe(true);
    expect(isRestorablePath('/squad/rooms?tab=2#end')).toBe(true);
  });

  it('refuses an absolute URL — the open-redirect case', () => {
    expect(isRestorablePath('https://evil.example/x')).toBe(false);
    expect(isRestorablePath('//evil.example/x')).toBe(false);
  });

  // A browser reads `/\host` as scheme-relative, exactly like `//host`.
  it('refuses a backslash, which a browser treats as another host', () => {
    expect(isRestorablePath('/\\evil.example/x')).toBe(false);
    expect(isRestorablePath('/squad\\..\\other')).toBe(false);
  });

  it('refuses traversal, including the encoded dots a browser resolves', () => {
    expect(isRestorablePath('/squad/../other')).toBe(false);
    expect(isRestorablePath('/squad/%2e%2e/other')).toBe(false);
    expect(isRestorablePath('/squad/%2E%2e/other')).toBe(false);
  });

  it('refuses non-paths and characters a URL parser silently drops', () => {
    expect(isRestorablePath('squad/x')).toBe(false);
    expect(isRestorablePath('')).toBe(false);
    expect(isRestorablePath('/\t/evil.example')).toBe(false);
    expect(isRestorablePath('/squad/x\ny')).toBe(false);
  });

  // The board's own server caps a saved location at 2048 characters; a longer
  // one would be refused on every save.
  it('refuses a path longer than a saved location may be', () => {
    expect(isRestorablePath(`/squad/${'x'.repeat(2048)}`)).toBe(false);
    expect(isRestorablePath(`/squad/${'x'.repeat(100)}`)).toBe(true);
  });
});
