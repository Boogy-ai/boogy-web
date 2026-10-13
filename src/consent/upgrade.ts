// The upgrade confirmation: the one screen on which a person agrees to move an
// app they run to a newer version. It runs on the platform's sign-in origin,
// which no app can script or frame, and it shows only what the platform put in
// the page's data for the signed-in person — never anything from the address
// bar. It upgrades exactly the move it shows.
//
// Built from the SDK, and styled by the same consent theme as the install page.

import { button } from '../components/button';
import { notice } from '../components/notice';
import { pill } from '../components/pill';
import { sheet } from '../components/sheet';
import { el, postJson, titled } from './dom';
import { adoptConsentCss } from './install';

export const UPGRADE_ROOT_ID = 'boogy-upgrade';
export const UPGRADE_DATA_ID = 'boogy-upgrade-data';

export interface UpgradeItem {
  kind: string;
  label: string;
  detail: string | null;
  tone: 'attention' | 'info';
}

export interface UpgradeData {
  serviceId: string;
  /** The deployment the platform saw when it built this page; echoed on the POST. */
  deploymentId: string;
  name: string;
  fromVersion: string;
  toVersion: string;
  bump: 'major' | 'minor' | 'patch';
  notes: string | null;
  items: UpgradeItem[];
  /** The app that asked, already validated by the platform. Told the outcome, and nobody else. */
  appOrigin: string;
  /** The signed-in person's handle. */
  handle: string;
  /** Single-use token the platform issued with this page; echoed on the POST, never read. */
  state: string;
  setupUrl?: string | null;
}

/** A move the platform refuses to offer (for instance, not a newer version). */
export interface UpgradeRefusal {
  error: string;
  message: string;
  /** The app that asked, when the platform validated it before refusing: the
   *  only audience for the cancel. */
  appOrigin?: string;
}

export type UpgradeMessage =
  | { boogy: 'upgrade_done'; serviceId: string; version: string }
  | { boogy: 'upgrade_cancelled' };

export interface UpgradeRequest {
  service_id: string;
  deployment_id: string;
  from_version: string;
  to_version: string;
  state: string;
}

export type UpgradeResult =
  | { ok: true; version: string }
  | { ok: false; error: string; message: string };

export interface UpgradeDeps {
  post(body: UpgradeRequest): Promise<UpgradeResult>;
  /** Tell the app window, if there is one. */
  send(msg: UpgradeMessage): void;
  close(): void;
}

function isRefusal(d: UpgradeData | UpgradeRefusal): d is UpgradeRefusal {
  return typeof (d as UpgradeRefusal).error === 'string';
}

/** Render the confirmation into `root`. */
export function mountUpgradeConsent(root: HTMLElement, data: UpgradeData | UpgradeRefusal, deps: UpgradeDeps): void {
  adoptConsentCss();

  const cancelled = () => {
    deps.send({ boogy: 'upgrade_cancelled' });
    deps.close();
  };

  if (isRefusal(data)) {
    const close = el('button', { type: 'button', ...button({ variant: 'solid' }) }, 'Close');
    close.addEventListener('click', cancelled);
    root.replaceChildren(el('div', { ...sheet() },
      el('header', { 'data-slot': 'head' }, 'Update'),
      el('div', { 'data-slot': 'body' }, el('p', { ...notice({ tone: 'danger' }) }, data.message)),
      el('footer', { 'data-slot': 'foot' }, close),
    ));
    return;
  }

  let busy = false;
  const status = el('p', { 'data-install': 'status', role: 'status' });
  const updateBtn = el('button', { type: 'button', ...button({ variant: 'solid' }) }, 'Update');
  const cancelBtn = el('button', { type: 'button', ...button({ variant: 'quiet' }) }, 'Cancel');
  // After a refusal the move cannot be retried from this page: only Close is left.
  let refused = false;

  const update = async () => {
    if (busy || refused) return;
    busy = true;
    updateBtn.disabled = true;
    status.textContent = 'Updating…';
    let out: UpgradeResult;
    try {
      out = await deps.post({
        service_id: data.serviceId,
        deployment_id: data.deploymentId,
        from_version: data.fromVersion,
        to_version: data.toVersion,
        state: data.state,
      });
    } catch {
      out = { ok: false, error: 'network', message: 'The update could not be sent. Close this window and try again from the app.' };
    }
    busy = false;
    if (out.ok) {
      status.textContent = '';
      deps.send({ boogy: 'upgrade_done', serviceId: data.serviceId, version: out.version });
      deps.close();
      return;
    }
    refused = true;
    status.textContent = out.message;
    updateBtn.remove();
    cancelBtn.textContent = 'Close';
  };

  updateBtn.addEventListener('click', () => { void update(); });
  cancelBtn.addEventListener('click', cancelled);

  const changes = data.items.length > 0
    ? el('ul', { 'data-install': 'list' }, ...data.items.map((i) =>
        el('li', i.tone === 'attention' ? { 'data-tone': 'attention' } : {},
          el('strong', {}, i.label), i.detail ? el('span', { 'data-install': 'detail' }, i.detail) : null)))
    : el('p', { 'data-install': 'text' }, 'Nothing else changes.');

  root.replaceChildren(el('div', { ...sheet() },
    el('header', { 'data-slot': 'head' }, `Update ${data.name}`),
    el('div', { 'data-slot': 'body' },
      el('p', { 'data-install': 'byline' },
        el('span', { ...pill({ variant: 'solid' }) }, `${data.fromVersion} → ${data.toVersion}`)),
      data.bump === 'major'
        ? el('p', { ...notice({ tone: 'warning' }) }, 'A major version can change how the app works.')
        : null,
      titled("What's new", el('p', { 'data-install': 'notes' }, data.notes ?? 'The author left no notes.')),
      titled('What changes', changes),
      el('p', { 'data-install': 'note' }, "Your data is checked when the update runs. If it can't be applied, nothing changes."),
      status,
      el('p', { 'data-install': 'note' }, `Requested by ${data.appOrigin}`),
    ),
    el('footer', { 'data-slot': 'foot' }, cancelBtn, updateBtn),
  ));
}

async function postUpgrade(req: UpgradeRequest): Promise<UpgradeResult> {
  const out = await postJson('/boogy/upgrade', req);
  if (out.ok && typeof out.body.version === 'string') return { ok: true, version: out.body.version };
  return out.ok ? { ok: false, error: 'http_200', message: 'The platform refused (200).' } : out;
}

/**
 * Start the confirmation on the platform's own page: read the record the
 * platform embedded, and wire the page to the platform and the app window.
 */
export function bootUpgradeConsent(): void {
  const root = document.getElementById(UPGRADE_ROOT_ID) ?? document.body;
  let data: UpgradeData | UpgradeRefusal | null = null;
  try {
    data = JSON.parse(document.getElementById(UPGRADE_DATA_ID)?.textContent ?? 'null') as UpgradeData | UpgradeRefusal | null;
  } catch {
    data = null;
  }
  if (!data) {
    root.replaceChildren(el('p', {}, 'This update is not available.'));
    return;
  }
  mountUpgradeConsent(root, data, {
    post: postUpgrade,
    send(msg) {
      const opener = window.opener as Window | null;
      if (!opener || opener.closed) return;
      // The platform-validated `appOrigin` is the only audience for an outcome.
      // A refusal record names it when the platform validated it before
      // refusing; one that names none sends only a bare cancel, which carries
      // nothing to protect, to any opener.
      if (data && !isRefusal(data)) opener.postMessage(msg, data.appOrigin);
      else if (data && typeof data.appOrigin === 'string') opener.postMessage(msg, data.appOrigin);
      else if (msg.boogy === 'upgrade_cancelled') opener.postMessage(msg, '*');
    },
    close: () => window.close(),
  });
}
