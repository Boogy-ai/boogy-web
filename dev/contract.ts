// Compare the fake's signed-out responses with a real host's. A fake that has
// drifted from the platform fails here instead of quietly lying in dev.
import { createFakePlatform } from './fake-platform.js';

type Shape = { status: number; type: string; keys?: Record<string, string> };

function shapeOf(status: number, contentType: string, body: string): Shape {
  const type = contentType.split(';')[0].trim();
  if (type !== 'application/json') return { status, type };
  const v = JSON.parse(body);
  if (v === null || typeof v !== 'object' || Array.isArray(v)) return { status, type, keys: { $: v === null ? 'null' : Array.isArray(v) ? 'array' : typeof v } };
  return { status, type, keys: Object.fromEntries(Object.entries(v).map(([k, x]) => [k, x === null ? 'null' : Array.isArray(x) ? 'array' : typeof x])) };
}

const CASES: { name: string; method: string; path: string }[] = [
  { name: 'config', method: 'GET', path: '/boogy/config' },
  { name: 'me (signed out)', method: 'GET', path: '/boogy/me' },
  { name: 'logout', method: 'POST', path: '/boogy/logout' },
];

async function main() {
  const i = process.argv.indexOf('--origin');
  const origin = i > 0 ? process.argv[i + 1] : undefined;
  if (!origin) throw new Error('usage: contract --origin https://<app origin>');
  const host = new URL(origin).host;
  const config = await fetch(`${origin}/boogy/config`).then((r) => r.json());
  const fake = createFakePlatform({ owner: config.owner, service: 'contract', users: [] });
  let failed = 0;
  for (const c of CASES) {
    const real = await fetch(`${origin}${c.path}`, { method: c.method, headers: { origin, 'sec-fetch-site': 'same-origin' } });
    const realShape = shapeOf(real.status, real.headers.get('content-type') ?? '', await real.text());
    const f = (await fake.handle({ method: c.method, url: c.path, headers: { host } }))!;
    const fakeShape = shapeOf(f.status, String(f.headers['content-type'] ?? ''), f.body);
    const same = JSON.stringify(realShape) === JSON.stringify(fakeShape);
    console.log(`${same ? 'ok  ' : 'DIFF'} ${c.name}${same ? '' : `\n  host: ${JSON.stringify(realShape)}\n  fake: ${JSON.stringify(fakeShape)}`}`);
    if (!same) failed++;
  }
  console.log(`${CASES.length - failed}/${CASES.length} endpoints match`);
  if (failed) process.exit(1);
}

main().catch((e) => {
  console.error(`contract check could not run: ${e.message}`);
  process.exit(2);
});
