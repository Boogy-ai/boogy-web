import { BoogyError } from '../errors';
import { awaitPopup } from './popup';
import { appOrigin, authOrigin } from './urls';
import { platformConfig } from './platform-config';

/** A published module version, as the registry names it. */
export interface ModuleRef {
  owner: string;
  name: string;
  version: string;
}

export interface InstallModuleOptions {
  module: ModuleRef;
  /** The name to suggest for the new service. The person can change it. */
  serviceId?: string;
}

export interface Installed {
  serviceId: string;
  url: string;
}

/** The query parameter a redirect-mode install returns with. */
export const INSTALLED_PARAM = 'boogy_installed';

export function installUrl(o: InstallModuleOptions, mode: 'popup' | 'redirect', redirect: string | null): string {
  const url = new URL(`${authOrigin()}/install`);
  const m = o.module;
  url.searchParams.set('module', `boogy://${m.owner}/modules/${m.name}@${m.version}`);
  if (o.serviceId) url.searchParams.set('service_id', o.serviceId);
  url.searchParams.set('app_origin', appOrigin(platformConfig().owner));
  url.searchParams.set('mode', mode);
  if (redirect !== null) url.searchParams.set('redirect', redirect);
  return url.toString();
}

/**
 * Ask the person, on the platform's own page, to install a module.
 *
 * The answer is believed only from the platform's sign-in origin: this app
 * cannot draw that page, so it cannot fake the confirmation either.
 */
// The install window is one named window, so only one install can be waiting
// on it. A new call supersedes the one before; otherwise both would accept
// the one answer the window gives.
let pending: AbortController | null = null;

export function runInstallFlow(o: InstallModuleOptions, mode: 'popup' | 'redirect'): Promise<Installed> {
  if (mode === 'redirect') {
    // A path, with leading slashes collapsed: `//host` would name another host.
    const path = location.pathname.replace(/^\/+/, '/') + location.search;
    location.assign(installUrl(o, 'redirect', path));
    // The page navigates away; the result arrives as `?boogy_installed=` on return.
    return new Promise<Installed>(() => {});
  }
  pending?.abort();
  const mine = new AbortController();
  pending = mine;
  const done = () => { if (pending === mine) pending = null; };
  return awaitPopup<Installed>({
    signal: mine.signal,
    url: installUrl(o, 'popup', null),
    name: 'boogy_install',
    origin: authOrigin(),
    blocked: () => new BoogyError('popup_blocked', 'The install window was blocked by the browser.'),
    aborted: () => new BoogyError('install_aborted', 'The install window was closed before finishing.'),
    decide(data) {
      const d = data as { boogy?: unknown; serviceId?: unknown; url?: unknown } | null;
      if (d?.boogy === 'install_done' && typeof d.serviceId === 'string' && typeof d.url === 'string') {
        return { value: { serviceId: d.serviceId, url: d.url } };
      }
      if (d?.boogy === 'install_cancelled') {
        return { error: new BoogyError('install_cancelled', 'The install was cancelled.') };
      }
      return null;
    },
  }).finally(done);
}

/**
 * On return from a redirect-mode install: the new service's id, or null.
 * Removes the parameter from the address so a reload does not see it again.
 */
export function takeInstalled(): string | null {
  const params = new URLSearchParams(location.search);
  const id = params.get(INSTALLED_PARAM);
  if (id === null) return null;
  params.delete(INSTALLED_PARAM);
  const rest = params.toString();
  history.replaceState(history.state, '', location.pathname + (rest ? `?${rest}` : ''));
  return id;
}
