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

  it('writes boogy_pkce=<verifier> with correct attributes', () => {
    setPkceCookie('test_verifier_value');

    expect(cookieWrites).toHaveLength(1);
    const written = cookieWrites[0];
    expect(written).toContain('boogy_pkce=test_verifier_value');
    expect(written).toContain('Path=/boogy/callback');
    expect(written).toContain('SameSite=Lax');
    expect(written).toContain('Max-Age=300');
    expect(written).toContain('Secure');
  });

  it('each call writes exactly one cookie string', () => {
    setPkceCookie('verifier_a');
    setPkceCookie('verifier_b');

    expect(cookieWrites).toHaveLength(2);
    expect(cookieWrites[0]).toContain('boogy_pkce=verifier_a');
    expect(cookieWrites[1]).toContain('boogy_pkce=verifier_b');
  });
});
