import { describe, it, expect, afterEach, beforeAll, vi } from 'vitest';
import { render } from 'preact';
import { act } from 'preact/test-utils';
import { FencedText, LinkPreview } from './index';
import { loadLinkFinder, PREVIEW_PATH, type LinkFinder } from '@boogy/web';

beforeAll(async () => {
  // Prime the loader with the vendored finder, as the host serves it.
  await loadLinkFinder(async () => (await import('../vendor/linkify-4.3.3.js' as string)) as LinkFinder);
});
afterEach(() => { document.body.replaceChildren(); vi.unstubAllGlobals(); vi.useRealTimers(); });

function mount(node: preact.ComponentChild): HTMLElement {
  const root = document.createElement('div');
  document.body.appendChild(root);
  act(() => render(node, root));
  return root;
}
const settle = async () => { await act(async () => { for (let i = 0; i < 5; i++) await new Promise((r) => setTimeout(r, 0)); }); };

/** The platform's answers, by link; anything else has no preview. */
function platform(cards: Record<string, { status: number; body?: unknown; headers?: Record<string, string> }[]>) {
  const asked: string[] = [];
  const fetcher = vi.fn(async (input: RequestInfo | URL) => {
    const link = new URL(String(input), 'https://app.example').searchParams.get('url')!;
    asked.push(link);
    const next = cards[link]?.shift() ?? { status: 204 };
    return new Response(next.body === undefined ? null : JSON.stringify(next.body), { status: next.status, headers: next.headers });
  });
  vi.stubGlobal('fetch', fetcher);
  return asked;
}
const card = (url: string) => ({ url, siteName: 'Example', title: `Title of ${url}`, description: 'About it.', image: null });

describe('<LinkPreview>', () => {
  it('a card that opens the page in a new tab, sending nothing back', async () => {
    platform({ 'https://a.example/1': [{ status: 200, body: card('https://a.example/1') }] });
    const root = mount(<LinkPreview url="https://a.example/1" />);
    await settle();
    const a = root.querySelector<HTMLAnchorElement>('a[data-boogy="link-preview"]')!;
    expect(a.getAttribute('href')).toBe('https://a.example/1');
    expect(a.getAttribute('target')).toBe('_blank');
    expect(a.getAttribute('rel')).toBe('noopener noreferrer');
    expect(a.getAttribute('data-layout')).toBe('none');
    expect(a.querySelector('[data-slot="site"]')!.textContent).toBe('Example');
    expect(a.querySelector('[data-slot="title"]')!.textContent).toBe('Title of https://a.example/1');
    expect(a.querySelector('[data-slot="description"]')!.textContent).toBe('About it.');
  });

  it('a page with no preview shows nothing', async () => {
    platform({});
    const root = mount(<LinkPreview url="https://a.example/none" />);
    await settle();
    expect(root.innerHTML).toBe('');
  });

  it('a platform too busy to answer is asked again a little later', async () => {
    vi.useFakeTimers();
    const asked = platform({ 'https://a.example/busy': [{ status: 429 }, { status: 200, body: card('https://a.example/busy') }] });
    const root = mount(<LinkPreview url="https://a.example/busy" />);
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    expect(root.querySelector('[data-boogy="link-preview"]')).toBeNull();
    await act(async () => { await vi.advanceTimersByTimeAsync(30_000); });
    // Reading the second answer's body takes real turns of the event loop.
    vi.useRealTimers();
    await settle();
    expect(asked).toEqual(['https://a.example/busy', 'https://a.example/busy']);
    expect(root.querySelector('[data-boogy="link-preview"]')).not.toBeNull();
  });
});

describe('<LinkPreview> told when to ask again', () => {
  it('waits as long as the platform says before asking again', async () => {
    vi.useFakeTimers();
    const asked = platform({ 'https://a.example/wait': [{ status: 429, headers: { 'retry-after': '60' } }, { status: 200, body: card('https://a.example/wait') }] });
    mount(<LinkPreview url="https://a.example/wait" />);
    await act(async () => { await vi.advanceTimersByTimeAsync(30_000); });
    expect(asked).toEqual(['https://a.example/wait']);
    await act(async () => { await vi.advanceTimersByTimeAsync(31_000); });
    expect(asked).toEqual(['https://a.example/wait', 'https://a.example/wait']);
  });
});

describe('<FencedText> links', () => {
  // A bare name is linked only under a real TLD (linkify's list): example.org.
  const text = 'see https://a.example/x, example.org and https://c.example/z!\n```\nhttps://code.example/\n```';

  it('links the addresses in its text, never in its code', async () => {
    platform({});
    const root = mount(<FencedText text={text} previews={0} />);
    await settle();
    const links = [...root.querySelectorAll<HTMLAnchorElement>('[data-slot="text"] a[data-slot="link"]')];
    expect(links.map((a) => [a.textContent, a.getAttribute('href')])).toEqual([
      ['https://a.example/x', 'https://a.example/x'],
      ['example.org', 'https://example.org'],
      ['https://c.example/z', 'https://c.example/z'],
    ]);
    for (const a of links) {
      expect(a.getAttribute('target')).toBe('_blank');
      expect(a.getAttribute('rel')).toBe('noopener noreferrer');
    }
    expect(root.querySelector('[data-slot="text"]')!.textContent).toBe('see https://a.example/x, example.org and https://c.example/z!');
    expect(root.querySelector('[data-boogy="code-block"] a')).toBeNull();
  });

  it('previews only the first two links of a message', async () => {
    const asked = platform({
      'https://a.example/x': [{ status: 200, body: card('https://a.example/x') }],
      'https://example.org': [{ status: 200, body: card('https://example.org') }],
    });
    const root = mount(<FencedText text={text} />);
    await settle();
    expect(asked).toEqual(['https://a.example/x', 'https://example.org']);
    expect(root.querySelectorAll('[data-boogy="link-preview"]').length).toBe(2);
  });

  it('previews none when asked for none', async () => {
    const asked = platform({});
    mount(<FencedText text="https://a.example/none-asked" previews={0} />);
    await settle();
    expect(asked).toEqual([]);
  });
});
