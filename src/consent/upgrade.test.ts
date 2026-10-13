import { describe, it, expect, vi, afterEach } from 'vitest';
import { mountUpgradeConsent, bootUpgradeConsent, UPGRADE_DATA_ID, UPGRADE_ROOT_ID, type UpgradeData, type UpgradeDeps } from './upgrade';
import { INSTALL_CONSENT_CSS } from './install';

/** The body of the consent theme's rule for exactly `selector`, or ''. */
const cssRule = (selector: string) => {
  const at = INSTALL_CONSENT_CSS.indexOf(`${selector} {`);
  return at < 0 ? '' : INSTALL_CONSENT_CSS.slice(at, INSTALL_CONSENT_CSS.indexOf('}', at));
};

afterEach(() => { document.body.replaceChildren(); });

const base: UpgradeData = {
  serviceId: 'wordle', deploymentId: 'dep-9', name: 'Wordle', fromVersion: '0.1.0', toVersion: '0.2.0', bump: 'minor',
  notes: 'Faster.', items: [], appOrigin: 'https://boards.local.boogy.app', handle: 'tester', state: 'st-1',
};

function mount(over: Partial<UpgradeData> = {}, deps: Partial<UpgradeDeps> = {}) {
  const root = document.createElement('div');
  document.body.appendChild(root);
  const d: UpgradeDeps = {
    post: vi.fn(async () => ({ ok: true as const, version: '0.2.0' })),
    send: vi.fn(),
    close: vi.fn(),
    ...deps,
  };
  mountUpgradeConsent(root, { ...base, ...over }, d);
  const button = (label: string) => [...root.querySelectorAll('button')].find((b) => b.textContent === label) as HTMLButtonElement | undefined;
  return { root, d, button, text: () => root.textContent ?? '' };
}
const settle = async () => { await new Promise((r) => setTimeout(r, 0)); await new Promise((r) => setTimeout(r, 0)); };

describe('what it shows', () => {
  it('the title, the version line and who asked', () => {
    const { text, root } = mount();
    expect(root.querySelector('[data-slot="head"]')!.textContent).toBe('Update Wordle');
    expect(text()).toContain('0.1.0 → 0.2.0');
    expect(text()).toContain('Requested by https://boards.local.boogy.app');
    expect(text()).toContain("Your data is checked when the update runs. If it can't be applied, nothing changes.");
  });

  it('notes are text, never markup', () => {
    const { root, text } = mount({ notes: '<img src=x onerror=alert(1)>' });
    expect(text()).toContain('<img src=x onerror=alert(1)>');
    expect(root.querySelector('img')).toBeNull();
  });

  it('says so when there are no notes and no other changes', () => {
    const { text } = mount({ notes: null });
    expect(text()).toContain('The author left no notes.');
    expect(text()).toContain('Nothing else changes.');
  });

  it('lists each change, marking the ones that need attention', () => {
    const { root, text } = mount({ items: [
      { kind: 'capability', label: 'Reach other websites', detail: 'api.example.com', tone: 'attention' },
      { kind: 'x', label: 'Smaller', detail: null, tone: 'info' },
    ] });
    expect(text()).toContain('Reach other websites');
    expect(text()).toContain('api.example.com');
    expect(text()).not.toContain('Nothing else changes.');
    expect(root.querySelectorAll('[data-tone="attention"]').length).toBe(1);
  });

  it('keeps the line breaks in the notes', () => {
    const { root } = mount({ notes: 'Faster lists.\nA new theme.' });
    const notes = root.querySelector('[data-install="notes"]')!;
    expect(notes.textContent).toBe('Faster lists.\nA new theme.');
    expect(cssRule('[data-install="notes"]')).toMatch(/white-space:\s*pre-line/);
  });

  it('shows each change as its label, then its detail on a line of its own', () => {
    const { root } = mount({ items: [
      { kind: 'capability', label: 'Websites that may call it', detail: 'https://a.example', tone: 'attention' },
      { kind: 'x', label: 'Smaller', detail: null, tone: 'info' },
    ] });
    const [first, second] = [...root.querySelectorAll('[data-install="list"] > li')];
    expect(first.querySelector('strong')!.textContent).toBe('Websites that may call it');
    expect(first.querySelector('[data-install="detail"]')!.textContent).toBe('https://a.example');
    expect(second.querySelector('[data-install="detail"]')).toBeNull();
    expect(cssRule('[data-install="detail"]')).toMatch(/display:\s*block/);
  });

  it('marks a change that needs attention in the accent', () => {
    expect(cssRule('[data-install="list"] > [data-tone="attention"]')).toMatch(/var\(--accent\)/);
  });

  it('warns on a major version only', () => {
    expect(mount({ bump: 'major' }).text()).toContain('A major version can change how the app works.');
    expect(mount({ bump: 'minor' }).text()).not.toContain('A major version');
  });
});

describe('Update and Cancel', () => {
  it('posts the exact body, then tells the app and closes', async () => {
    const m = mount();
    m.button('Update')!.click();
    await settle();
    expect(m.d.post).toHaveBeenCalledWith({
      service_id: 'wordle', deployment_id: 'dep-9', from_version: '0.1.0', to_version: '0.2.0', state: 'st-1',
    });
    expect(m.d.send).toHaveBeenCalledWith({ boogy: 'upgrade_done', serviceId: 'wordle', version: '0.2.0' });
    expect(m.d.close).toHaveBeenCalled();
  });

  it('a refusal shows its message and leaves only Close, which cancels', async () => {
    const m = mount({}, { post: vi.fn(async () => ({ ok: false as const, error: 'instance_moved', message: 'This app changed since the page was opened.' })) });
    m.button('Update')!.click();
    await settle();
    expect(m.text()).toContain('This app changed since the page was opened.');
    expect(m.button('Update')).toBeUndefined();
    expect(m.d.send).not.toHaveBeenCalled();
    m.button('Close')!.click();
    expect(m.d.send).toHaveBeenCalledWith({ boogy: 'upgrade_cancelled' });
    expect(m.d.close).toHaveBeenCalled();
  });

  it('a network failure is a refusal too', async () => {
    const m = mount({}, { post: vi.fn(async () => { throw new Error('down'); }) });
    m.button('Update')!.click();
    await settle();
    expect(m.text()).toContain('The update could not be sent. Close this window and try again from the app.');
    expect(m.button('Close')).toBeDefined();
  });

  it('Cancel tells the app and closes', () => {
    const m = mount();
    m.button('Cancel')!.click();
    expect(m.d.send).toHaveBeenCalledWith({ boogy: 'upgrade_cancelled' });
    expect(m.d.close).toHaveBeenCalled();
    expect(m.d.post).not.toHaveBeenCalled();
  });
});

describe('a move the platform refuses', () => {
  it('shows the message as text with only Close', () => {
    const root = document.createElement('div');
    document.body.appendChild(root);
    const d: UpgradeDeps = { post: vi.fn(), send: vi.fn(), close: vi.fn() };
    mountUpgradeConsent(root, { error: 'not_newer', message: '<b>Already</b> up to date.' }, d);
    expect(root.textContent).toContain('<b>Already</b> up to date.');
    expect(root.querySelector('b')).toBeNull();
    expect([...root.querySelectorAll('button')].map((b) => b.textContent)).toEqual(['Close']);
    root.querySelector('button')!.click();
    expect(d.send).toHaveBeenCalledWith({ boogy: 'upgrade_cancelled' });
    expect(d.close).toHaveBeenCalled();
    expect(d.post).not.toHaveBeenCalled();
  });
});

describe('boot', () => {
  function page(json: string | null) {
    const root = document.createElement('div'); root.id = UPGRADE_ROOT_ID;
    document.body.append(root);
    if (json !== null) {
      const s = document.createElement('script'); s.type = 'application/json'; s.id = UPGRADE_DATA_ID; s.textContent = json;
      document.body.append(s);
    }
    return root;
  }
  it('reads the embedded record', () => {
    const root = page(JSON.stringify(base));
    bootUpgradeConsent();
    expect(root.textContent).toContain('Update Wordle');
  });
  it('says it is unavailable when the record is null or absent', () => {
    const root = page('null');
    bootUpgradeConsent();
    expect(root.textContent).toContain('This update is not available.');
    document.body.replaceChildren();
    const r2 = page(null);
    bootUpgradeConsent();
    expect(r2.textContent).toContain('This update is not available.');
  });
  it('renders the error shape', () => {
    const root = page(JSON.stringify({ error: 'plan_unavailable', message: 'No plan.' }));
    bootUpgradeConsent();
    expect(root.textContent).toContain('No plan.');
  });
});

// The outcome goes to exactly the origin the platform validated; the one
// wildcard is a data-free cancel on a page that has no such origin.
describe('boot: what is sent to the app window', () => {
  function bootWith(record: unknown) {
    const root = document.createElement('div'); root.id = UPGRADE_ROOT_ID;
    document.body.append(root);
    const s = document.createElement('script'); s.type = 'application/json'; s.id = UPGRADE_DATA_ID; s.textContent = JSON.stringify(record);
    document.body.append(s);
    const postMessage = vi.fn();
    vi.stubGlobal('opener', { closed: false, postMessage });
    vi.spyOn(window, 'close').mockImplementation(() => {});
    bootUpgradeConsent();
    const button = (label: string) => [...root.querySelectorAll('button')].find((b) => b.textContent === label) as HTMLButtonElement;
    return { postMessage, button };
  }
  afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

  it('a finished update is posted to the validated app origin, never a wildcard', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ version: '0.2.0' }), { status: 200 })));
    const { postMessage, button } = bootWith(base);
    button('Update').click();
    await settle();
    expect(postMessage).toHaveBeenCalledTimes(1);
    expect(postMessage).toHaveBeenCalledWith({ boogy: 'upgrade_done', serviceId: 'wordle', version: '0.2.0' }, base.appOrigin);
  });

  it('a cancel on a real record goes to the app origin too', () => {
    const { postMessage, button } = bootWith(base);
    button('Cancel').click();
    expect(postMessage).toHaveBeenCalledExactlyOnceWith({ boogy: 'upgrade_cancelled' }, base.appOrigin);
  });

  it('a refusal record that names the validated origin sends its cancel there', () => {
    const { postMessage, button } = bootWith({ error: 'not_newer', message: 'Up to date.', appOrigin: base.appOrigin });
    button('Close').click();
    expect(postMessage).toHaveBeenCalledExactlyOnceWith({ boogy: 'upgrade_cancelled' }, base.appOrigin);
  });

  it('a refusal record has no origin, so only its data-free cancel is posted, to "*"', () => {
    const { postMessage, button } = bootWith({ error: 'not_newer', message: 'Up to date.' });
    button('Close').click();
    expect(postMessage).toHaveBeenCalledExactlyOnceWith({ boogy: 'upgrade_cancelled' }, '*');
  });
});
