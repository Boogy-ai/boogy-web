// <InfoList>: label/value pairs. Empty values are left out; a value with an
// `href` is a link that opens outside the page — only when the address is
// http(s). Values often come from someone else (a published manifest), and a
// `javascript:` address must never become something to click.
import type { ComponentChildren } from 'preact';
import { infoList } from '@boogy/web';

export interface InfoItem { label: string; value?: ComponentChildren; href?: string }

/** Whether `href` is a web address, the one kind this list links to. */
function isWebAddress(href: string): boolean {
  try { const p = new URL(href).protocol; return p === 'https:' || p === 'http:'; } catch { return false; }
}

export function InfoList({ items }: { items: readonly InfoItem[] }) {
  const shown = items.filter((i) => i.value !== undefined && i.value !== null && i.value !== '');
  if (shown.length === 0) return null;
  return (
    <dl {...infoList()}>
      {shown.map((i) => [
        <dt key={`${i.label}-t`}>{i.label}</dt>,
        <dd key={`${i.label}-d`}>
          {i.href && isWebAddress(i.href) ? <a href={i.href} target="_blank" rel="noreferrer">{i.value}</a> : i.value}
        </dd>,
      ])}
    </dl>
  );
}
