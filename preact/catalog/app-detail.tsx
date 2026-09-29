import type { AppEntry } from '@boogy/web/catalog';
import { useEffect, useRef } from 'preact/hooks';
import { DetailHeader } from '../detail-header';
import { Section } from '../section';
import { InfoList } from '../info-list';
import { Pill } from '../index';
import { Stack } from '../stack';
import { Notice } from '../notice';
import { Button } from '../button';
import { AppIcon } from './app-icon';
import { ACTION_LABEL } from './app-row';

/** A link shown as its host and path, without the scheme. */
const shortUrl = (url: string) => {
  try { const u = new URL(url); return u.host + u.pathname.replace(/\/$/, ''); } catch { return url; }
};

/** A page about one app: header and action, description, information, keywords. */
export function AppDetail({ entry, onAction, busy, note, actionLabel, autoFocus }: {
  entry: AppEntry; onAction: (e: AppEntry) => void; busy?: boolean; note?: string; actionLabel?: string;
  /** Focus the action on mount — for a page that replaces the view focus was in. */
  autoFocus?: boolean;
}) {
  const action = useRef<HTMLElement>(null);
  useEffect(() => { if (autoFocus) action.current?.focus(); }, []);
  const meta = [entry.publisher, entry.category, entry.instance, entry.version && `v${entry.version}`].filter((p) => p).join(' · ');
  const link = (label: string, href?: string) => ({ label, value: href && shortUrl(href), href });
  const info = [
    { label: 'Version', value: entry.version },
    { label: 'License', value: entry.license },
    link('Source', entry.links.source),
    link('Website', entry.links.website),
    link('Docs', entry.links.docs),
  ];
  return (
    <Stack as="article" gap={3}>
      <DetailHeader
        media={<AppIcon entry={entry} size="lg" />}
        title={entry.name}
        meta={meta}
        actions={
          <Button ref={action} variant="solid" disabled={busy} onClick={() => onAction(entry)}>
            {busy ? 'Installing…' : actionLabel ?? ACTION_LABEL[entry.action]}
          </Button>
        }
      />
      {note && <Notice>{note}</Notice>}
      {/* A blank line in the manifest's description is a new paragraph. */}
      {(entry.description ?? '').split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean).map((p, i) => <p key={i}>{p}</p>)}
      {info.some((i) => i.value) && <Section title="Information"><InfoList items={info} /></Section>}
      {entry.keywords.length > 0 && (
        <Stack direction="row" gap={1}>
          {entry.keywords.map((k) => <Pill key={k}>{k}</Pill>)}
        </Stack>
      )}
    </Stack>
  );
}
