// The interface zoom: one multiplier on the size unit (`--zoom`, which every
// `--u` declaration in the foundation multiplies by). It is the product of two
// values: this app's OWN, which its controls step and this browser remembers,
// and the HOST's, which a board framing the page may send. A board can size
// every pane at once while each app still fine-tunes itself.
//
// Not browser zoom: only what is sized from the unit grows, so text reflows,
// SVG stays crisp, hairlines stay hairlines and an image keeps its shape.

/** The steps an app's own controls move along. */
export const ZOOM_STEPS: readonly number[] = Object.freeze([0.8, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2]);
/** The bounds of any zoom a board may send. */
export const ZOOM_MIN = 0.5;
export const ZOOM_MAX = 3;

export interface ZoomState {
  /** What the page is drawn at: host × own. */
  zoom: number;
  /** This app's own value: a step on ZOOM_STEPS. */
  own: number;
  /** What a board framing this page sent; 1 when none. */
  host: number;
  canZoomIn: boolean;
  canZoomOut: boolean;
}

const STORAGE_PREFIX = 'boogy.zoom.v1:';
let own = 1;
let host = 1;
let key: string | null = null;
const listeners = new Set<(s: ZoomState) => void>();

/** A factor a board may send: a finite number in [ZOOM_MIN, ZOOM_MAX]. */
export function isZoomFactor(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v) && v >= ZOOM_MIN && v <= ZOOM_MAX;
}

/** The next step on the ladder from `value` in `direction`; `value` itself
 *  when there is none that way (never a step the wrong way). */
export function stepZoom(value: number, direction: 1 | -1): number {
  const next = direction === 1
    ? ZOOM_STEPS.find((s) => s > value)
    : [...ZOOM_STEPS].reverse().find((s) => s < value);
  return next ?? value;
}

export function canStepZoom(value: number, direction: 1 | -1): boolean {
  return stepZoom(value, direction) !== value;
}

/** The default key: the app's MOUNT, so every route of one app shares one
 *  value and two apps on one origin keep their own. The platform points the
 *  page's `<base href>` at the mount, inside a versioned asset prefix
 *  (`<mount>/_a/<content hash>/`); the prefix is dropped, so a new build keeps
 *  the value. An app at the origin root (a custom domain) is the empty key.
 *  With no `<base>`, the page's first path segment. Read once per page. */
let defaultKey: string | null = null;
function mountKey(): string {
  if (defaultKey !== null) return defaultKey;
  let k = '';
  if (typeof document !== 'undefined') {
    const base = document.querySelector<HTMLBaseElement>('base[href]');
    if (base) {
      k = new URL(base.href).pathname.replace(/\/_a\/[^/]+\/.*$/, '/').replace(/^\/+|\/+$/g, '');
    } else if (typeof location !== 'undefined') {
      k = location.pathname.split('/').filter(Boolean)[0] ?? '';
    }
  }
  return (defaultKey = k);
}

function currentKey(): string {
  return key ?? mountKey();
}

function read(): number {
  try {
    const raw = globalThis.localStorage?.getItem(STORAGE_PREFIX + currentKey());
    if (raw === null || raw === undefined || raw === '') return 1;
    const n = Number(raw);
    return ZOOM_STEPS.includes(n) ? n : 1;
  } catch {
    return 1;
  }
}

function write(): void {
  try {
    if (own === 1) globalThis.localStorage?.removeItem(STORAGE_PREFIX + currentKey());
    else globalThis.localStorage?.setItem(STORAGE_PREFIX + currentKey(), String(own));
  } catch {
    // Blocked or full: the value holds for this page only.
  }
}

export function zoomState(): ZoomState {
  return { zoom: host * own, own, host, canZoomIn: canStepZoom(own, 1), canZoomOut: canStepZoom(own, -1) };
}

function apply(): void {
  const s = zoomState();
  if (typeof document !== 'undefined') {
    const root = document.documentElement;
    if (s.zoom === 1) {
      root.style.removeProperty('--zoom');
      root.removeAttribute('data-zoom');
    } else {
      root.style.setProperty('--zoom', String(s.zoom));
      root.setAttribute('data-zoom', '');
    }
  }
  for (const listener of [...listeners]) listener(s);
}

function setOwn(value: number): void {
  if (value === own) return;
  own = value;
  write();
  apply();
}

export function zoomIn(): void { setOwn(stepZoom(own, 1)); }
export function zoomOut(): void { setOwn(stepZoom(own, -1)); }
export function resetZoom(): void { setOwn(1); }

export function onZoomChange(listener: (s: ZoomState) => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

/** Where this app's own value is remembered (no key: the page's first path
 *  segment). Re-reads the value from there. */
export function rememberZoom(k?: string): void {
  key = k ?? null;
  own = read();
  apply();
}

/** Read the remembered value under the current key and draw it. Called by
 *  installFoundation, so a page draws at its size from the first paint. */
export function initZoom(): void {
  own = read();
  apply();
}

/** The zoom a board framing this page sent. Set by connectPane only; anything
 *  that is not a finite number in [ZOOM_MIN, ZOOM_MAX] is ignored. */
export function setHostZoom(factor: number): void {
  if (!isZoomFactor(factor) || factor === host) return;
  host = factor;
  apply();
}

/** No board any more: the host value goes back to 1. */
export function clearHostZoom(): void {
  if (host === 1) return;
  host = 1;
  apply();
}
