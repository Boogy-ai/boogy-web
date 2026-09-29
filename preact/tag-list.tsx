// <TagList>: a wrapping row of pills, at most `max` of them and then "+N".
import { Stack } from './stack';
import { Pill } from './index';

export function TagList({ tags, max }: { tags: readonly string[]; max?: number }) {
  if (tags.length === 0) return null;
  const shown = max != null ? tags.slice(0, max) : tags;
  const more = tags.length - shown.length;
  return (
    <Stack direction="row" gap={1}>
      {shown.map((t) => <Pill key={t}>{t}</Pill>)}
      {more > 0 && <Pill key="+more" title={tags.slice(shown.length).join(', ')}>+{more}</Pill>}
    </Stack>
  );
}
