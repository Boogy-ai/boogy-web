import { describe, expect, it, vi } from 'vitest';
import { uploadFile } from './upload';

describe('uploadFile', () => {
  const ticket = { url: 'https://app.example/files/up/abc?sig=1', method: 'PUT' };
  const file = new Blob(['\\x89PNG...'], { type: 'image/png' });

  it('sends the bytes to the ticket, as it says, typed as the file is', async () => {
    const fetcher = vi.fn(async (_url: RequestInfo | URL, _init?: RequestInit) => new Response(null, { status: 200 }));
    await uploadFile(ticket, file, fetcher);
    expect(fetcher).toHaveBeenCalledTimes(1);
    const [url, init] = fetcher.mock.calls[0];
    expect(url).toBe(ticket.url);
    expect(init?.method).toBe('PUT');
    expect(init?.body).toBe(file);
    expect(new Headers(init?.headers).get('content-type')).toBe('image/png');
  });

  it('a refusal says why, in words a person can act on', async () => {
    const said = async (status: number) => uploadFile(ticket, file, async () => new Response(null, { status })).catch((e: Error) => e.message);
    expect(await said(413)).toMatch(/too large/i);
    expect(await said(415)).toMatch(/not accepted/i);
    expect(await said(507)).toMatch(/no room/i);
    expect(await said(500)).toMatch(/500/);
  });
});
