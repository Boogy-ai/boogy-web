// <DetailHeader>: the top of a page about one thing.
import type { ComponentChildren } from 'preact';
import { detailHeader } from '@boogy/web';

export interface DetailHeaderProps {
  media: ComponentChildren;
  title: ComponentChildren;
  meta?: ComponentChildren;
  actions?: ComponentChildren;
}

export function DetailHeader({ media, title, meta, actions }: DetailHeaderProps) {
  return (
    <header {...detailHeader()}>
      <span data-slot="media">{media}</span>
      <div data-slot="text">
        <h2 data-slot="title">{title}</h2>
        {meta != null && <span data-slot="meta">{meta}</span>}
        {actions != null && <div data-slot="actions">{actions}</div>}
      </div>
    </header>
  );
}
