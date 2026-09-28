import { describe, it, expect } from 'vitest';
import { createHash, randomBytes } from 'node:crypto';
import { createFakePlatform, AUTH_PREFIX, SESSION_COOKIE, type FakeRequest } from './fake-platform';
import { parsePlatformConfig } from '../src/internal/platform-config';

const ORIGIN = 'http://localhost:5173';
const fake = () => createFakePlatform({ owner: 'tester', service: 'boards', users: [{ id: 'alice', displayName: 'Alice' }, { id: 'bob' }] });
const req = (method: string, url: string, headers: Record<string, string> = {}): FakeRequest => ({
  method, url, headers: { host: 'localhost:5173', ...headers },
});
const json = (r: { body: string }) => JSON.parse(r.body);

function pkce() {
  const verifier = randomBytes(32).toString('base64url');
  const challenge = createHash('sha256').update(verifier).digest('base64url');
  return { verifier, challenge };
}

async function signIn(p: ReturnType<typeof fake>, user: string, mode: 'redirect' | 'popup' = 'redirect') {
  const { verifier, challenge } = pkce();
  const q = new URLSearchParams({ aud: 'boogy://tester/services/boards', app_origin: ORIGIN, redirect: '/b/x', state: 'st', code_challenge: challenge, mode });
  const pick = await p.handle(req('GET', `${AUTH_PREFIX}/authorize/pick?user=${user}&${q}`));
  const loc = String(pick!.headers.location);
  const cb = await p.handle(req('GET', loc.replace(ORIGIN, ''), { cookie: `boogy_pkce=${verifier}` }));
  return cb!;
}

describe('fake platform', () => {
  it('answers config the SDK parser accepts, pointing at itself', async () => {
    const r = await fake().handle(req('GET', '/boogy/config'));
    const cfg = parsePlatformConfig(json(r!));
    expect(cfg.owner).toBe('tester');
    expect(cfg.authOrigin.startsWith(ORIGIN)).toBe(true);
  });

  it('carries consoleOrigin only when one is configured, as the platform does', async () => {
    const without = json((await fake().handle(req('GET', '/boogy/config')))!);
    expect('consoleOrigin' in without).toBe(false);
    const withIt = createFakePlatform({ owner: 'tester', service: 'boards', users: [], consoleOrigin: 'https://localhost:3001' });
    const cfg = json((await withIt.handle(req('GET', '/boogy/config')))!);
    expect(cfg.consoleOrigin).toBe('https://localhost:3001');
  });

  it('reports signed out as 200 null', async () => {
    const r = await fake().handle(req('GET', '/boogy/me'));
    expect(r!.status).toBe(200);
    expect(json(r!)).toBeNull();
  });

  it('renders a picker listing every test user', async () => {
    const r = await fake().handle(req('GET', `${AUTH_PREFIX}/authorize?state=s&mode=redirect&redirect=/`));
    expect(r!.headers['content-type']).toContain('text/html');
    expect(r!.body).toContain('Alice');
    expect(r!.body).toContain('bob');
  });

  it('completes the PKCE round trip and signs the user in (redirect mode)', async () => {
    const p = fake();
    const cb = await signIn(p, 'alice');
    expect(cb.status).toBe(302);
    expect(cb.headers.location).toBe('/b/x');
    const cookies = ([] as string[]).concat(cb.headers['set-cookie'] as string[]);
    const session = cookies.find((c) => c.startsWith(`${SESSION_COOKIE}=`))!;
    expect(cookies.some((c) => c.startsWith('boogy_pkce=;') && c.includes('Max-Age=0'))).toBe(true);
    const me = await p.handle(req('GET', '/boogy/me', { cookie: session.split(';')[0] }));
    expect(json(me!)).toMatchObject({ pairwiseId: 'dev-alice', services: ['boards'], displayName: 'Alice', avatarUrl: null });
  });

  it('posts sso_done to the app origin in popup mode', async () => {
    const cb = await signIn(fake(), 'bob', 'popup');
    expect(cb.status).toBe(200);
    expect(cb.body).toContain(`boogy: "sso_done"`);
    expect(cb.body).toContain(JSON.stringify(ORIGIN));
  });

  it('refuses a verifier that does not match the challenge', async () => {
    const p = fake();
    const { challenge } = pkce();
    const q = new URLSearchParams({ app_origin: ORIGIN, redirect: '/', state: 'st', code_challenge: challenge, mode: 'redirect' });
    const pick = await p.handle(req('GET', `${AUTH_PREFIX}/authorize/pick?user=alice&${q}`));
    const cb = await p.handle(req('GET', String(pick!.headers.location).replace(ORIGIN, ''), { cookie: 'boogy_pkce=wrong' }));
    expect(cb!.status).toBe(400);
  });

  it('refuses a code used twice', async () => {
    const p = fake();
    const { verifier, challenge } = pkce();
    const q = new URLSearchParams({ app_origin: ORIGIN, redirect: '/', state: 'st', code_challenge: challenge, mode: 'redirect' });
    const pick = await p.handle(req('GET', `${AUTH_PREFIX}/authorize/pick?user=alice&${q}`));
    const url = String(pick!.headers.location).replace(ORIGIN, '');
    await p.handle(req('GET', url, { cookie: `boogy_pkce=${verifier}` }));
    const again = await p.handle(req('GET', url, { cookie: `boogy_pkce=${verifier}` }));
    expect(again!.status).toBe(400);
  });

  it('signs out of the origin with the host shape', async () => {
    const r = await fake().handle(req('POST', '/boogy/logout'));
    expect(json(r!)).toEqual({ signedOut: 'origin' });
    expect(String(r!.headers['set-cookie'])).toContain('Max-Age=0');
  });

  it('never hands out a URL off the dev origin (Review Focus 4)', async () => {
    const p = fake();
    const cfg = json((await p.handle(req('GET', '/boogy/config')))!);
    expect(cfg.authOrigin.startsWith(ORIGIN)).toBe(true);
    const { challenge } = pkce();
    // Each unsafe input on its own, beside otherwise-valid ones, so each guard is tested alone.
    const foreignOrigin = new URLSearchParams({ app_origin: 'https://evil.example', redirect: '/x', state: 's', code_challenge: challenge, mode: 'redirect' });
    expect((await p.handle(req('GET', `${AUTH_PREFIX}/authorize/pick?user=alice&${foreignOrigin}`)))!.status).toBe(400);
    for (const redirect of ['https://evil.example/x', '//evil.example/x']) {
      const offOrigin = new URLSearchParams({ app_origin: ORIGIN, redirect, state: 's', code_challenge: challenge, mode: 'redirect' });
      expect((await p.handle(req('GET', `${AUTH_PREFIX}/authorize/pick?user=alice&${offOrigin}`)))!.status, redirect).toBe(400);
    }
  });

  it('lists and revokes grants', async () => {
    const p = fake();
    const cb = await signIn(p, 'alice');
    const session = ([] as string[]).concat(cb.headers['set-cookie'] as string[]).find((c) => c.startsWith(SESSION_COOKIE))!.split(';')[0];
    const list = await p.handle(req('GET', `${AUTH_PREFIX}/_agents/grants`, { cookie: session }));
    expect(json(list!)[0]).toMatchObject({ app: 'tester/boards' });
    const del = await p.handle(req('DELETE', `${AUTH_PREFIX}/_agents/grants/tester/boards`, { cookie: session }));
    expect(del!.status).toBe(204);
  });

  it('fails an endpoint on demand and recovers', async () => {
    const p = fake();
    p.setFailure('me', '500');
    expect((await p.handle(req('GET', '/boogy/me')))!.status).toBe(500);
    p.setFailure('me', 'offline');
    expect((await p.handle(req('GET', '/boogy/me')))!.offline).toBe(true);
    p.setFailure('me', null);
    expect((await p.handle(req('GET', '/boogy/me')))!.status).toBe(200);
  });

  it('leaves every other path alone', async () => {
    expect(await fake().handle(req('GET', '/boards/api/boards'))).toBeNull();
    expect(await fake().handle(req('GET', '/app.tsx'))).toBeNull();
  });
});
