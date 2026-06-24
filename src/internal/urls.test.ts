import { describe, it, expect } from 'vitest';
import {
  parseApp,
  baseFromHost,
  appOrigin,
  authOrigin,
  authorizeUrl,
} from './urls';

describe('parseApp', () => {
  it('parses owner/service', () => {
    expect(parseApp('alice/notes')).toEqual({ owner: 'alice', service: 'notes' });
  });

  it('throws on boogy:// scheme', () => {
    expect(() => parseApp('boogy://x')).toThrow();
  });

  it('throws on empty string', () => {
    expect(() => parseApp('')).toThrow();
  });

  it('throws on single segment', () => {
    expect(() => parseApp('alice')).toThrow();
  });

  it('throws on extra segments', () => {
    expect(() => parseApp('a/b/c')).toThrow();
  });

  it('throws on empty owner', () => {
    expect(() => parseApp('/service')).toThrow();
  });

  it('throws on empty service', () => {
    expect(() => parseApp('owner/')).toThrow();
  });
});

describe('baseFromHost', () => {
  it('strips https scheme', () => {
    expect(baseFromHost('https://boogy.ai')).toBe('boogy.ai');
  });

  it('strips http scheme', () => {
    expect(baseFromHost('http://boogy.ai')).toBe('boogy.ai');
  });

  it('strips trailing slash', () => {
    expect(baseFromHost('https://boogy.ai/')).toBe('boogy.ai');
  });

  it('returns bare domain unchanged', () => {
    expect(baseFromHost('boogy.ai')).toBe('boogy.ai');
  });
});

describe('appOrigin', () => {
  it('builds subdomain origin', () => {
    expect(appOrigin('alice', 'boogy.ai')).toBe('https://alice.boogy.ai');
  });
});

describe('authOrigin', () => {
  it('builds auth subdomain origin', () => {
    expect(authOrigin('boogy.ai')).toBe('https://auth.boogy.ai');
  });
});

describe('authorizeUrl', () => {
  const base = 'boogy.ai';
  const params = {
    base,
    owner: 'alice',
    service: 'notes',
    redirect: '/notes/callback',
    state: 'abc123',
    codeChallenge: 'challenge_value',
    mode: 'popup' as const,
  };

  it('points to auth subdomain', () => {
    const u = new URL(authorizeUrl(params));
    expect(u.origin).toBe('https://auth.boogy.ai');
  });

  it('has /authorize path', () => {
    const u = new URL(authorizeUrl(params));
    expect(u.pathname).toBe('/authorize');
  });

  it('sets aud to workload URI', () => {
    const u = new URL(authorizeUrl(params));
    expect(u.searchParams.get('aud')).toBe('boogy://alice/services/notes');
  });

  it('sets app_origin to subdomain', () => {
    const u = new URL(authorizeUrl(params));
    expect(u.searchParams.get('app_origin')).toBe('https://alice.boogy.ai');
  });

  it('sets mode', () => {
    const u = new URL(authorizeUrl(params));
    expect(u.searchParams.get('mode')).toBe('popup');
  });

  it('sets redirect', () => {
    const u = new URL(authorizeUrl(params));
    expect(u.searchParams.get('redirect')).toBe('/notes/callback');
  });

  it('sets state', () => {
    const u = new URL(authorizeUrl(params));
    expect(u.searchParams.get('state')).toBe('abc123');
  });

  it('sets code_challenge', () => {
    const u = new URL(authorizeUrl(params));
    expect(u.searchParams.get('code_challenge')).toBe('challenge_value');
  });
});
