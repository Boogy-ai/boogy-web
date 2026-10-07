// Keeps an app's address and title in step with the page framing it, for an
// app that does not report them itself. The platform adds this script to every
// page an app serves from its own origin; an app that calls `connectPane`
// replaces it.
import { loadPlatformConfig } from './internal/platform-config';
import { connectAutoPane } from './pane';

export async function startAutoPane(win: Window = window): Promise<boolean> {
  if (win.parent === win) return false;
  let service: string | undefined;
  try {
    service = (await loadPlatformConfig()).service;
  } catch {
    return false;
  }
  if (!service) return false;
  const pane = connectAutoPane({ service });
  if (!pane) return false;

  const here = () => `${win.location.pathname}${win.location.search}${win.location.hash}`;
  const reportLocation = () => pane.reportLocation(here());
  for (const name of ['pushState', 'replaceState'] as const) {
    const original = win.history[name].bind(win.history);
    win.history[name] = (...args: Parameters<History['pushState']>) => {
      original(...args);
      reportLocation();
    };
  }
  win.addEventListener('popstate', reportLocation);
  win.addEventListener('hashchange', reportLocation);

  const reportTitle = () => {
    const title = win.document.title.trim();
    if (title) pane.reportTitle(title);
  };
  new MutationObserver(reportTitle).observe(win.document.head, { subtree: true, childList: true, characterData: true });

  reportLocation();
  reportTitle();
  return true;
}
