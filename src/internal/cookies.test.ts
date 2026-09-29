import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { setPkceCookie } from './cookies';

describe('setPkceCookie', () => {
  let cookieWrites: string[] = [];
  let originalDescriptor: PropertyDescriptor | undefined;

  beforeEach(() => {
    cookieWrites = [];
    // Capture the original descriptor so we can restore it
    originalDescriptor =
      Object.getOwnPropertyDescriptor(Object.getPrototypeOf(document), 'cookie') ??
      Object.getOwnPropertyDescriptor(document, 'cookie');
    // Install a capturing setter on the document instance
    Object.defineProperty(document, 'cookie', {
      configurable: true,
      get() {
        return originalDescriptor?.get?.call(this) ?? '';
      },
      set(val: string) {
        cookieWrites.push(val);
      },
    });
  });

  // Restore the original descriptor after each test
  afterEach(() => {
    if (originalDescriptor) {
      Object.defineProperty(document, 'cookie', {
        ...originalDescriptor,
        configurable: true,
      });
    }
  });

  // `__Host-`: no other host — not even a sibling subdomain on the same site —
  // can set a cookie under this name, so none can plant a verifier of its own
  // and sign the person in as someone else. The browser keeps a `__Host-`
  // cookie only with `Secure`, no `Domain` and `Path=/` exactly.
  it('writes __Host-boogy_pkce=<verifier> with the host-prefix attributes', () => {
    setPkceCookie('test_verifier_value');

    expect(cookieWrites).toHaveLength(1);
    const written = cookieWrites[0];
    expect(written.startsWith('__Host-boogy_pkce=test_verifier_value;')).toBe(true);
    const attrs = written.split(';').map((a) => a.trim()).slice(1);
    expect(attrs).toContain('Path=/');
    expect(attrs.filter((a) => a.startsWith('Path='))).toEqual(['Path=/']);
    expect(attrs.some((a) => a.startsWith('Domain'))).toBe(false);
    expect(attrs).toContain('SameSite=Lax');
    expect(attrs).toContain('Max-Age=300');
    expect(attrs).toContain('Secure');
  });

  it('each call writes exactly one cookie string', () => {
    setPkceCookie('verifier_a');
    setPkceCookie('verifier_b');

    expect(cookieWrites).toHaveLength(2);
    expect(cookieWrites[0]).toContain('__Host-boogy_pkce=verifier_a');
    expect(cookieWrites[1]).toContain('__Host-boogy_pkce=verifier_b');
  });
});
