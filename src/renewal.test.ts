import { describe, it, expect } from 'vitest';
import { sessionOrRenewed, withRenewal } from './renewal';

class Unauth extends Error {}
const isUnauth = (e: unknown) => e instanceof Unauth;

describe('withRenewal', () => {
  it('a 401 renews once and retries once', async () => {
    let attempts = 0;
    let renewals = 0;
    const out = await withRenewal(
      async () => { if (attempts++ === 0) throw new Unauth(); return 'ok'; },
      async () => { renewals++; return true; },
      isUnauth,
    );
    expect([out, renewals, attempts]).toEqual(['ok', 1, 2]);
  });

  it('a renewal that fails leaves the 401 as it was', async () => {
    await expect(withRenewal(async () => { throw new Unauth(); }, async () => false, isUnauth)).rejects.toBeInstanceOf(Unauth);
  });

  it('never twice: a second 401 after a renewal is returned', async () => {
    let renewals = 0;
    await expect(withRenewal(async () => { throw new Unauth(); }, async () => { renewals++; return true; }, isUnauth)).rejects.toBeInstanceOf(Unauth);
    expect(renewals).toBe(1);
  });

  it('other errors are not a reason to renew', async () => {
    let renewals = 0;
    await expect(withRenewal(async () => { throw new Error('500'); }, async () => { renewals++; return true; }, isUnauth)).rejects.toThrow('500');
    expect(renewals).toBe(0);
  });
});

describe('sessionOrRenewed', () => {
  it('a signed-out read renews and reads again', async () => {
    let reads = 0;
    expect(await sessionOrRenewed(async () => (reads++ === 0 ? null : { id: 'pw' }), async () => true)).toEqual({ id: 'pw' });
    expect(reads).toBe(2);
  });

  it('signed out stays signed out when renewal fails, with no second read', async () => {
    let reads = 0;
    expect(await sessionOrRenewed(async () => { reads++; return null; }, async () => false)).toBeNull();
    expect(reads).toBe(1);
  });

  it('a signed-in read does not renew', async () => {
    let renewals = 0;
    await sessionOrRenewed(async () => ({ id: 'pw' }), async () => { renewals++; return true; });
    expect(renewals).toBe(0);
  });
});
