// The Back control a page's head starts with: the SDK's back chevron on a
// quiet icon button. One definition for every head that has one.
import { Button } from './button';
import { Glyph } from './glyphs';

export function BackButton({ label = 'Back', onClick }: { label?: string; onClick: () => void }) {
  return (
    <Button variant="quiet" shape="icon" label={label} onClick={onClick}>
      <Glyph shape="back" />
    </Button>
  );
}
