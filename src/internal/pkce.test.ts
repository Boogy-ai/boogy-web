import { describe, it, expect } from 'vitest';
import { s256Challenge, randomVerifier, randomState } from './pkce';

describe('pkce', () => {
  it('s256 matches the RFC 7636 Appendix B known vector', async () => {
    // verifier: dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk
    // expected challenge: E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM
    expect(
      await s256Challenge('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk'),
    ).toBe('E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM');
  });

  it('randomVerifier is at least 43 url-safe characters', () => {
    expect(randomVerifier()).toMatch(/^[A-Za-z0-9_-]{43,}$/);
  });

  it('two randomVerifier calls differ', () => {
    expect(randomVerifier()).not.toBe(randomVerifier());
  });

  it('two randomState calls differ', () => {
    expect(randomState()).not.toBe(randomState());
  });

  it('randomState is non-empty base64url', () => {
    expect(randomState()).toMatch(/^[A-Za-z0-9_-]+$/);
  });
});
