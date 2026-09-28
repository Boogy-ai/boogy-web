// The install confirmation: the one screen on which a person agrees to add a
// module to their account. It runs on the platform's sign-in origin, which no
// app can script or frame, and it shows only what the platform put in `data`
// for the signed-in person — never anything from the address bar. It installs
// exactly the record it shows.
//
// Built from the SDK: a sheet (head, scrolling body, footer actions), sections,
// fields and buttons. The page's own rules are only its theme and the few
// text styles no component owns.

import { button } from '../components/button';
import { pill } from '../components/pill';
import { sheet, field, section } from '../components/sheet';

/** The platform's own pages: dark, neutral, the SDK's accent. Plus the few
 *  text styles no component owns. Adopted on mount. */
export const INSTALL_CONSENT_CSS = `@layer boogy.components {
  :root { --scheme: dark; --tint: 0; }
  [data-install="byline"] { display: flex; align-items: center; gap: var(--space-2); margin: 0; color: var(--text-2); font-size: var(--fs-detail); }
  [data-install="byline"] strong { color: var(--text-1); font-weight: 600; }
  [data-install="text"] { margin: 0; color: var(--text-2); }
  [data-install="list"] { margin: 0; padding-inline-start: var(--space-4); color: var(--text-1); }
  [data-install="note"] { margin: 0; color: var(--text-3); font-size: var(--fs-caption); }
  [data-install="status"] { margin: 0; color: var(--text-2); font-size: var(--fs-detail); }
  [data-install="status"]:empty { display: none; }
}`;

let consentSheet: CSSStyleSheet | null = null;
function adoptConsentCss(): void {
  if (consentSheet || typeof CSSStyleSheet === 'undefined' || !('adoptedStyleSheets' in document)) return;
  consentSheet = new CSSStyleSheet();
  consentSheet.replaceSync(INSTALL_CONSENT_CSS);
  document.adoptedStyleSheets = [...document.adoptedStyleSheets, consentSheet];
}

export interface InstallListing {
  capabilities: string[];
  needs_setup: boolean;
  charges: boolean;
  max_charge_usd: string | null;
}

/** One of the person's apps, and the address it holds. */
export interface TakenApp {
  serviceId: string;
  path: string;
}

export interface InstallData {
  owner: string;
  name: string;
  version: string;
  description: string;
  /** Null when the platform could not read what the module may do: no one-click install then. */
  listing: InstallListing | null;
  suggestedServiceId: string;
  /** The app that asked, already validated by the platform. Told the outcome, and nobody else. */
  appOrigin: string;
  /** Redirect mode: the path on `appOrigin` to return to. */
  redirect: string | null;
  mode: 'popup' | 'redirect';
  /** The signed-in person's handle. */
  handle: string;
  /** Single-use token the platform issued with this page; echoed on the POST, never read. */
  state: string;
  /** Where the person's apps are served, e.g. `https://tester.boogy.app`. The new app opens at this plus its path.
   *  Omitted when the platform cannot say; the address field then shows the path alone. */
  tenantOrigin?: string;
  /** The path the module declares for itself. Omitted when the platform cannot read it. */
  defaultPath?: string;
  /** The person's apps: the names and addresses already in use. */
  taken: TakenApp[];
  /** Where to finish installing a module that needs setup, if the platform has one. */
  setupUrl?: string;
}

export interface InstallRequest {
  owner: string;
  name: string;
  version: string;
  service_id: string;
  mount_path: string;
  state: string;
}

export type InstallResult =
  | { ok: true; service_id: string; url: string }
  | { ok: false; error: string; message: string };

export type InstallMessage =
  | { boogy: 'install_done'; serviceId: string; url: string }
  | { boogy: 'install_cancelled' };

export interface InstallDeps {
  post(req: InstallRequest): Promise<InstallResult>;
  /** Tell the app window. False when there is no window to tell. */
  notify(msg: InstallMessage, targetOrigin: string): boolean;
  navigate(url: string): void;
  close(): void;
  /** How long Install stays disabled after the page shows or regains focus,
   *  so a click aimed at the app cannot land on it. Default 800 ms. */
  armDelayMs?: number;
}

const WORDS: Record<string, string> = {
  store: 'Keep its own data',
  auth: 'Know who is signed in',
  clock: 'Read the time',
  entropy: 'Generate random values',
  logging: 'Write logs you can read',
  peer: 'Call your other apps',
  outbound_http: 'Reach other websites',
  background_jobs: 'Run work in the background',
  websockets: 'Push live updates',
  files: 'Store files',
  signing: 'Sign with keys it holds',
};

/** Refusals that need words of their own rather than the platform's message.
 *  `expired` covers every confirmation the platform cannot verify (malformed,
 *  forged or out of date), on purpose, so it names no cause. */
const PLAIN: Record<string, string> = {
  expired: 'This confirmation has expired. Close this window and press Install again.',
  not_signed_in: 'You’re signed out of Boogy. Sign in to the app again, then press Install.',
  wrong_session: 'You’re signed out of Boogy. Sign in to the app again, then press Install.',
};

const NAME_RE = /^[A-Za-z0-9_-]+$/;
const PATH_RE = /^\/[A-Za-z0-9_-]+(\/[A-Za-z0-9_-]+)*$/;

/** Why a name cannot be used, or null. */
export function serviceIdProblem(id: string): string | null {
  if (id === '') return 'Give it a name.';
  if (!NAME_RE.test(id)) return 'Use letters, digits, - and _ only.';
  if (id.toLowerCase() === 'boogy') return '“boogy” is reserved.';
  return null;
}

/** Why an address path cannot be used, or null. */
export function mountPathProblem(path: string): string | null {
  if (!path.startsWith('/')) return 'The address must start with /.';
  if (path === '/boogy' || path.startsWith('/boogy/')) return '/boogy is reserved.';
  if (!PATH_RE.test(path)) return 'Use letters, digits, - and _, with / between parts.';
  return null;
}

/** Two addresses collide when one is the other or lies inside it. */
function overlaps(a: string, b: string): boolean {
  return a === b || a.startsWith(`${b}/`) || b.startsWith(`${a}/`);
}

type Child = Node | string | null | false;

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Record<string, string> = {},
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  for (const c of children) if (c) node.append(c);
  return node;
}

/** Where redirect mode returns to: `redirect` as a path on the app's origin.
 *  Anything that would resolve elsewhere (`//host`, `/\host`, an absolute or
 *  `javascript:` URL) falls back to the app's root. */
function returnAddress(data: InstallData): URL {
  const root = new URL('/', data.appOrigin);
  try {
    const back = new URL(data.redirect ?? '/', root);
    return back.origin === root.origin ? back : root;
  } catch {
    return root;
  }
}

interface Field {
  node: HTMLElement;
  input: HTMLInputElement;
  message: HTMLElement;
  set(problem: string | null): void;
}

function makeField(label: string, name: string, prefix?: string): Field {
  const id = `boogy-install-${name}`;
  const input = el('input', { id, name, 'data-slot': 'control', autocomplete: 'off', spellcheck: 'false' });
  const message = el('small', { 'data-slot': 'message', id: `${id}-message`, 'aria-live': 'polite' });
  input.setAttribute('aria-describedby', message.id);
  const control = prefix
    ? el('div', { 'data-slot': 'group' }, el('span', { 'data-slot': 'prefix' }, prefix), input)
    : input;
  const node = el('div', { ...field() }, el('label', { 'data-slot': 'label', for: id }, label), control, message);
  return {
    node, input, message,
    set(problem) {
      message.textContent = problem ?? '';
      if (problem) { node.setAttribute('data-invalid', 'true'); input.setAttribute('aria-invalid', 'true'); }
      else { node.removeAttribute('data-invalid'); input.removeAttribute('aria-invalid'); }
    },
  };
}

function titled(header: string, ...children: Child[]): HTMLElement {
  return el('section', { ...section() }, el('h2', { 'data-slot': 'header' }, header), ...children);
}

/** Render the confirmation into `root`. Returns a function that removes it. */
export function mountInstallConsent(root: HTMLElement, data: InstallData, deps: InstallDeps): () => void {
  adoptConsentCss();
  const armDelay = deps.armDelayMs ?? 800;
  const listing = data.listing;
  const oneClick = listing !== null && !listing.needs_setup;
  const taken = data.taken ?? [];

  let armed = false;
  let busy = false;
  let armTimer: ReturnType<typeof setTimeout> | undefined;
  // The address follows the name until the person edits the address.
  let pathFollowsName = true;
  // Refusals the platform returned, until the field they concern is edited.
  let nameRefused: string | null = null;
  let pathRefused: string | null = null;
  // Installed, with no window to tell: the remaining button only closes.
  let installed = false;

  const isTaken = (p: string) => taken.some((t) => overlaps(t.path, p));
  const nameTaken = (n: string) => taken.some((t) => t.serviceId.toLowerCase() === n.toLowerCase());
  // Open ready to install: the app's suggestion is a preference, and the first
  // free name (and an address free with it) is what the page starts on.
  const firstFree = (base: string): string => {
    const free = (n: string) => !nameTaken(n) && !isTaken(`/${n}`);
    if (free(base)) return base;
    for (let i = 2; ; i++) if (free(`${base}-${i}`)) return `${base}-${i}`;
  };
  const startName = nameTaken(data.suggestedServiceId) ? firstFree(data.suggestedServiceId) : data.suggestedServiceId;
  const nameField = makeField('Name', 'service_id');
  nameField.input.value = startName;
  const pathField = makeField('Web address', 'mount_path', data.tenantOrigin);
  pathField.input.value = data.defaultPath && !isTaken(data.defaultPath)
    ? data.defaultPath
    : `/${isTaken(`/${startName}`) ? firstFree(startName) : startName}`;

  const status = el('p', { 'data-install': 'status', role: 'status' });
  const installBtn = oneClick ? el('button', { type: 'button', ...button({ variant: 'solid' }) }, 'Install') : null;
  const cancelBtn = el('button', { type: 'button', ...button({ variant: 'quiet' }) }, 'Cancel');

  const nameProblem = (): string | null => {
    const n = nameField.input.value;
    const own = serviceIdProblem(n);
    if (own) return own;
    if (nameTaken(n)) {
      return `You already have an app named “${n}”. Choose another name.`;
    }
    return nameRefused;
  };
  const pathProblem = (): string | null => {
    const p = pathField.input.value;
    const own = mountPathProblem(p);
    if (own) return own;
    const holder = taken.find((t) => overlaps(t.path, p));
    if (holder) return `This address is already used by your app “${holder.serviceId}”.`;
    return pathRefused;
  };
  const sync = () => {
    const n = nameProblem();
    const p = pathProblem();
    nameField.set(n);
    pathField.set(p);
    if (installBtn) installBtn.disabled = !armed || busy || n !== null || p !== null;
  };
  const arm = () => {
    armed = false;
    sync();
    clearTimeout(armTimer);
    armTimer = setTimeout(() => { armed = true; sync(); }, armDelay);
  };

  const done = (serviceId: string, url: string) => {
    if (data.mode === 'redirect') {
      const back = returnAddress(data);
      back.searchParams.set('boogy_installed', serviceId);
      deps.navigate(back.toString());
      return;
    }
    if (deps.notify({ boogy: 'install_done', serviceId, url }, data.appOrigin)) {
      deps.close();
    } else {
      status.textContent = `Installed. It opens at ${url}. You can close this window.`;
      installed = true;
      installBtn?.remove();
      cancelBtn.textContent = 'Close';
    }
  };

  const install = async () => {
    if (!installBtn || installBtn.disabled) return;
    busy = true;
    sync();
    status.textContent = 'Installing…';
    const req: InstallRequest = {
      owner: data.owner, name: data.name, version: data.version,
      service_id: nameField.input.value, mount_path: pathField.input.value, state: data.state,
    };
    let out: InstallResult;
    try {
      out = await deps.post(req);
    } catch {
      out = { ok: false, error: 'network', message: 'Could not reach Boogy. Try again.' };
    }
    busy = false;
    if (out.ok) {
      status.textContent = '';
      done(out.service_id, out.url);
      return;
    }
    status.textContent = '';
    if (out.error === 'service_exists') {
      nameRefused = `You already have an app named “${req.service_id}”. Choose another name.`;
    } else if (out.error === 'mount_path_in_use') {
      pathRefused = 'This address is already in use. Choose another.';
    } else {
      status.textContent = PLAIN[out.error] ?? out.message;
    }
    arm();
  };

  const cancel = () => {
    if (installed) { deps.close(); return; }
    if (data.mode === 'redirect') {
      deps.navigate(returnAddress(data).toString());
      return;
    }
    deps.notify({ boogy: 'install_cancelled' }, data.appOrigin);
    deps.close();
  };

  nameField.input.addEventListener('input', () => {
    nameRefused = null;
    if (pathFollowsName) { pathField.input.value = `/${nameField.input.value}`; pathRefused = null; }
    sync();
  });
  pathField.input.addEventListener('input', () => {
    pathFollowsName = false;
    pathRefused = null;
    sync();
  });
  installBtn?.addEventListener('click', () => { void install(); });
  cancelBtn.addEventListener('click', () => cancel());

  const onFocus = () => arm();
  const onVisible = () => { if (document.visibilityState === 'visible') arm(); };
  window.addEventListener('focus', onFocus);
  document.addEventListener('visibilitychange', onVisible);

  const capabilities = listing && listing.capabilities.length > 0
    ? titled('It will be able to', el('ul', { 'data-install': 'list' }, ...listing.capabilities.map((c) => el('li', {}, WORDS[c] ?? c))))
    : null;
  const charges = listing?.charges
    ? titled('Cost', el('p', { 'data-install': 'text' },
        listing.max_charge_usd ? `Up to $${listing.max_charge_usd} per use.` : 'It charges per use.'))
    : null;
  const setup = !oneClick
    ? el('p', { 'data-install': 'text' },
        listing ? 'This app needs setting up before it can run, so it cannot be installed from here. '
                : 'What this app may do could not be read, so it cannot be installed from here. ',
        listing && data.setupUrl ? el('a', { href: data.setupUrl, target: '_blank', rel: 'noopener' }, 'Set it up') : null)
    : null;

  const view = el('div', { ...sheet() },
    el('header', { 'data-slot': 'head' }, `Install ${data.name}`),
    el('div', { 'data-slot': 'body' },
      el('p', { 'data-install': 'byline' },
        el('span', {}, 'by ', el('strong', {}, data.owner)),
        el('span', { ...pill({ variant: 'solid' }) }, `v${data.version}`)),
      data.description ? el('p', { 'data-install': 'text' }, data.description) : null,
      capabilities,
      charges,
      oneClick ? nameField.node : null,
      oneClick ? pathField.node : null,
      setup,
      status,
      el('p', { 'data-install': 'note' }, `Asked by ${new URL(data.appOrigin).host}. It will be added to ${data.handle}’s apps.`),
    ),
    el('footer', { 'data-slot': 'foot' }, cancelBtn, installBtn),
  );
  root.replaceChildren(view);
  if (armDelay > 0) arm(); else { armed = true; sync(); }

  return () => {
    clearTimeout(armTimer);
    window.removeEventListener('focus', onFocus);
    document.removeEventListener('visibilitychange', onVisible);
    view.remove();
  };
}

export const INSTALL_DATA_ID = 'boogy-install-data';
export const INSTALL_ROOT_ID = 'boogy-install';

async function postInstall(req: InstallRequest): Promise<InstallResult> {
  const res = await fetch('/install', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(req),
  });
  const body = (await res.json().catch(() => null)) as Record<string, unknown> | null;
  if (res.ok && body && typeof body.service_id === 'string' && typeof body.url === 'string') {
    return { ok: true, service_id: body.service_id, url: body.url };
  }
  const words = body?.message ?? body?.detail;
  return {
    ok: false,
    error: typeof body?.error === 'string' ? body.error : `http_${res.status}`,
    message: typeof words === 'string' ? words : `The platform refused (${res.status}).`,
  };
}

/**
 * Start the confirmation on the platform's own page: read the record the
 * platform embedded, and wire the page to the platform and the app window.
 * The page's script entry calls this and nothing else, so the page needs no
 * inline script.
 */
export function bootInstallConsent(opts: { armDelayMs?: number } = {}): void {
  const root = document.getElementById(INSTALL_ROOT_ID) ?? document.body;
  let data: InstallData | null = null;
  try {
    data = JSON.parse(document.getElementById(INSTALL_DATA_ID)?.textContent ?? 'null') as InstallData | null;
  } catch {
    data = null;
  }
  if (!data) {
    root.replaceChildren(el('p', {}, 'This module is not available.'));
    return;
  }
  mountInstallConsent(root, data, {
    post: postInstall,
    notify(msg, targetOrigin) {
      const opener = window.opener as Window | null;
      if (!opener || opener.closed) return false;
      opener.postMessage(msg, targetOrigin);
      return true;
    },
    navigate: (url) => location.assign(url),
    close: () => window.close(),
    armDelayMs: opts.armDelayMs,
  });
}
