import { describe, it, expect, vi, afterEach } from 'vitest';
import { mountInstallConsent, bootInstallConsent, type InstallData, type InstallDeps } from './install';

afterEach(() => { document.body.replaceChildren(); });

const base: InstallData = {
  owner: 'wordleapp', name: 'wordle', version: '0.1.9', description: 'A word game.',
  listing: { capabilities: ['store'], needs_setup: false, charges: false, max_charge_usd: null },
  suggestedServiceId: 'wordle', appOrigin: 'https://boards.local.boogy.app', redirect: null, mode: 'popup',
  handle: 'tester', state: 'st-1',
};
/** Where the platform says the new app opens: an address of its own. */
const OPENS_AT = 'https://wordle-k3v9.local.boogy.app';

function mount(over: Partial<InstallData> = {}, deps: Partial<InstallDeps> = {}) {
  const root = document.createElement('div');
  document.body.appendChild(root);
  const d: InstallDeps = {
    post: vi.fn(async () => ({ ok: true as const, service_id: 'wordle', url: OPENS_AT })),
    notify: vi.fn(() => true),
    navigate: vi.fn(),
    close: vi.fn(),
    armDelayMs: 0,
    ...deps,
  };
  mountInstallConsent(root, { ...base, ...over }, d);
  const $ = <T extends Element = HTMLElement>(s: string) => root.querySelector(s) as T | null;
  const button = (label: string) => [...root.querySelectorAll('button')].find((b) => b.textContent === label) as HTMLButtonElement | undefined;
  const name = () => $<HTMLInputElement>('input[name="service_id"]')!;
  const fieldOf = (input: HTMLInputElement) => input.closest('[data-boogy="field"]') as HTMLElement;
  const messageOf = (input: HTMLInputElement) => fieldOf(input).querySelector('[data-slot="message"]')!.textContent ?? '';
  const type = (input: HTMLInputElement, value: string) => { input.value = value; input.dispatchEvent(new Event('input')); };
  const text = () => root.textContent ?? '';
  return { root, d, $, button, name, fieldOf, messageOf, type, text, install: () => button('Install') };
}
const tick = () => new Promise((r) => setTimeout(r, 0));
const settle = async () => { await tick(); await tick(); };

describe('the page is built from the SDK', () => {
  it('a sheet with the title in its head, the details in its body, and the actions in its foot', () => {
    const { $ } = mount();
    const sheet = $('[data-boogy="sheet"]')!;
    expect(sheet.querySelector('[data-slot="head"]')!.textContent).toBe('Install wordle');
    expect(sheet.querySelector('[data-slot="foot"]')!.querySelectorAll('[data-boogy="button"]')).toHaveLength(2);
    expect(sheet.querySelectorAll('[data-slot="body"] [data-boogy="field"]')).toHaveLength(1);
  });
});

describe('what it shows', () => {
  it('who published it, which version, what it does and what it will be able to do', () => {
    const { text } = mount();
    expect(text()).toContain('wordleapp');
    expect(text()).toContain('0.1.9');
    expect(text()).toContain('A word game.');
    expect(text()).toContain('Keep its own data');
  });

  it('the most one use can cost', () => {
    expect(mount({ listing: { capabilities: [], needs_setup: false, charges: true, max_charge_usd: '0.05' } }).text()).toMatch(/up to \$0\.05 per use/i);
  });

  it('which app asked, and whose account it goes into', () => {
    const { text } = mount();
    expect(text()).toContain('boards.local.boogy.app');
    expect(text()).toContain('tester');
  });

  // The platform gives every app an address of its own, so there is none to
  // choose here: the page asks for a name alone, and says where the app opens
  // once it is installed.
  it('no address to choose: a name alone', () => {
    const { $, root } = mount();
    expect($('input[name="mount_path"]')).toBeNull();
    expect(root.querySelector('[data-slot="prefix"]')).toBeNull();
    expect(root.querySelectorAll('input')).toHaveLength(1);
  });
});

describe('the name', () => {
  it('refuses a reserved or malformed name, in words, before anything is sent', () => {
    const { name, type, messageOf, fieldOf, install } = mount();
    type(name(), 'boogy');
    expect(messageOf(name())).toMatch(/reserved/);
    expect(fieldOf(name()).dataset.invalid).toBe('true');
    expect(install()!.disabled).toBe(true);
    type(name(), 'two words');
    expect(messageOf(name())).toMatch(/letters, digits/);
    type(name(), 'wordle');
    expect(messageOf(name())).toBe('');
    expect(install()!.disabled).toBe(false);
  });
});

describe('installing', () => {
  it('sends exactly the record shown, with the name and no address', async () => {
    const { install, d } = mount();
    install()!.click();
    await tick();
    expect(d.post).toHaveBeenCalledWith({ owner: 'wordleapp', name: 'wordle', version: '0.1.9', service_id: 'wordle', state: 'st-1' });
  });

  it('arms Install only after a pause, and again whenever the window regains focus', async () => {
    const { install } = mount({}, { armDelayMs: 30 });
    expect(install()!.disabled).toBe(true);
    await new Promise((r) => setTimeout(r, 60));
    expect(install()!.disabled).toBe(false);
    window.dispatchEvent(new Event('focus'));
    expect(install()!.disabled).toBe(true);
  });

  it('with no listing, or when setup is needed, there is no one-click install', () => {
    expect(mount({ listing: null }).install()).toBeUndefined();
    document.body.replaceChildren();
    const s = mount({ listing: { capabilities: ['outbound_http'], needs_setup: true, charges: false, max_charge_usd: null } });
    expect(s.install()).toBeUndefined();
    expect(s.text()).toMatch(/needs setting up/i);
  });

  it('a name the platform says is taken lands on the name field', async () => {
    const { install, name, messageOf } = mount({}, { post: vi.fn(async () => ({ ok: false as const, error: 'service_exists', message: 'x' })) });
    install()!.click();
    await settle();
    expect(messageOf(name())).toMatch(/already have an app named “wordle”/);
  });

  for (const [error, words] of [
    ['expired', /expired\. Close this window and press Install again/],
    ['not_signed_in', /signed out of Boogy/],
    ['wrong_session', /signed out of Boogy/],
  ] as const) {
    it(`${error}: says in plain words what to do, not the platform's code`, async () => {
      const { install, text } = mount({}, { post: vi.fn(async () => ({ ok: false as const, error, message: 'raw' })) });
      install()!.click();
      await settle();
      expect(text()).toMatch(words);
      expect(text()).not.toContain('raw');
    });
  }

  it('any other refusal is shown in the platform’s words', async () => {
    const { install, text } = mount({}, { post: vi.fn(async () => ({ ok: false as const, error: 'quota', message: 'You have reached your limit.' })) });
    install()!.click();
    await settle();
    expect(text()).toContain('You have reached your limit.');
  });

  it('popup: tells only the asking app it is done, then closes', async () => {
    const { install, d } = mount();
    install()!.click();
    await settle();
    expect(d.notify).toHaveBeenCalledWith({ boogy: 'install_done', serviceId: 'wordle', url: OPENS_AT }, 'https://boards.local.boogy.app');
    expect(d.close).toHaveBeenCalled();
  });

  it('popup with no window to tell: says where it was installed', async () => {
    const { install, text } = mount({}, { notify: vi.fn(() => false) });
    install()!.click();
    await settle();
    expect(text()).toMatch(/Installed/);
    expect(text()).toContain(OPENS_AT);
  });

  it('after installing with no window to tell, Close only closes: it never reports a cancel', async () => {
    const notify = vi.fn(() => false);
    const { install, button, d } = mount({}, { notify });
    install()!.click();
    await settle();
    button('Close')!.click();
    expect(notify).not.toHaveBeenCalledWith({ boogy: 'install_cancelled' }, expect.anything());
    expect(d.close).toHaveBeenCalled();
  });

  it('redirect: returns to the app, never off its origin', async () => {
    for (const redirect of ['/b/one', '//evil.com/x', 'javascript:alert(1)//']) {
      const { install, d } = mount({ mode: 'redirect', redirect });
      install()!.click();
      await settle();
      const went = new URL((d.navigate as ReturnType<typeof vi.fn>).mock.calls[0][0] as string);
      expect(went.origin).toBe('https://boards.local.boogy.app');
      expect(went.searchParams.get('boogy_installed')).toBe('wordle');
      document.body.replaceChildren();
    }
  });

  it('cancel tells the app, then closes', () => {
    const { button, d } = mount();
    button('Cancel')!.click();
    expect(d.notify).toHaveBeenCalledWith({ boogy: 'install_cancelled' }, 'https://boards.local.boogy.app');
    expect(d.close).toHaveBeenCalled();
  });
});

describe('bootInstallConsent', () => {
  it('reads the embedded record and posts JSON to /install on this origin', async () => {
    const script = document.createElement('script');
    script.type = 'application/json';
    script.id = 'boogy-install-data';
    script.textContent = JSON.stringify(base);
    document.body.appendChild(script);
    const root = document.createElement('div');
    root.id = 'boogy-install';
    document.body.appendChild(root);
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ error: 'quota', message: 'limit' }), { status: 409 }));
    vi.stubGlobal('fetch', fetchMock);
    bootInstallConsent({ armDelayMs: 0 });
    ([...root.querySelectorAll('button')].find((b) => b.textContent === 'Install') as HTMLButtonElement).click();
    await settle(); await tick();
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('/install');
    expect(init.credentials).toBe('same-origin');
    expect(JSON.parse(init.body as string)).not.toHaveProperty('mount_path');
    expect(root.textContent).toContain('limit');
    vi.unstubAllGlobals();
  });

  it('with no record, says the module is not available and offers nothing to click', () => {
    const root = document.createElement('div');
    root.id = 'boogy-install';
    document.body.appendChild(root);
    bootInstallConsent();
    expect(root.querySelector('button')).toBeNull();
    expect(root.textContent).toMatch(/not available/i);
  });
});
