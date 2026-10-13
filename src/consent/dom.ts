// What the platform's confirmation pages share: building their DOM and
// talking to the platform. Both pages are built from the SDK's components;
// this holds the few helpers they would otherwise each carry a copy of.

import { section } from '../components/sheet';

export type Child = Node | string | null | false;

/** An element with attributes and children; a falsy child is skipped. Text
 *  children are appended as text, never parsed as markup. */
export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Record<string, string> = {},
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  for (const c of children) if (c) node.append(c);
  return node;
}

/** A section with a heading. */
export function titled(header: string, ...children: Child[]): HTMLElement {
  return el('section', { ...section() }, el('h2', { 'data-slot': 'header' }, header), ...children);
}

/** The platform's answer to a confirmation: the JSON body when it accepted, or
 *  its reason in words. */
export type PostOutcome =
  | { ok: true; body: Record<string, unknown> }
  | { ok: false; error: string; message: string };

/** POST `req` as JSON to `path` on this page's own origin, with its session. */
export async function postJson(path: string, req: unknown): Promise<PostOutcome> {
  const res = await fetch(path, {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(req),
  });
  const body = (await res.json().catch(() => null)) as Record<string, unknown> | null;
  if (res.ok && body) return { ok: true, body };
  const words = body?.message ?? body?.detail;
  return {
    ok: false,
    error: typeof body?.error === 'string' ? body.error : `http_${res.status}`,
    message: typeof words === 'string' ? words : `The platform refused (${res.status}).`,
  };
}
