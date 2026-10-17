// <ImageField>: a field for one image (a logo, a picture of someone): the
// image now, or its name's initials while there is none; Upload, which opens
// a picker of the types taken; and Remove while there is an image. A file of
// another type, or too large, is refused here, saying why, before anything is
// sent. A picked file is handed to `onPick` (which uploads it: `uploadFile`
// with a ticket from the app's service); the field is busy until it is taken,
// and a failure's message shows under it.
import type { ComponentChildren, JSX } from 'preact';
import { useId, useRef, useState } from 'preact/hooks';
import { field, type ThumbnailGround } from '@boogy/web';
import { ActionButton } from './action-button';
import { FieldMessage } from './field-message';
import { useFormState } from './form';
import { Switch } from './switch';
import { Thumbnail } from './thumbnail';

/** PNG, JPEG and WebP: never SVG, which can carry script. */
const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp'] as const;
const TYPE_NAMES: Record<string, string> = { 'image/png': 'PNG', 'image/jpeg': 'JPEG', 'image/webp': 'WebP', 'image/gif': 'GIF', 'image/avif': 'AVIF' };

export type ImageFieldProps = {
  label: string;
  /** The image now, or null for none. */
  src: string | null;
  /** What it is of: its initials stand in while there is no image. */
  name: string;
  /** The types taken. Default PNG, JPEG and WebP. */
  accept?: readonly string[];
  /** The largest file taken, in bytes. */
  maxBytes?: number;
  /** A file picked and checked: send it, and throw to refuse it (the
   *  message shows under the field). */
  onPick: (file: File) => void | Promise<unknown>;
  /** Take the image off. No Remove without it. */
  onRemove?: () => void | Promise<unknown>;
  /** A hint under the field. */
  message?: ComponentChildren;
  /** The upload button's words. Default "Upload image". */
  uploadLabel?: string;
  /** What the image sits on (`Thumbnail`'s `ground`). */
  ground?: ThumbnailGround;
  /** A Background switch: on puts the image on a padded fill, off on none. */
  onGroundChange?: (ground: ThumbnailGround) => void;
};

/** "PNG, JPEG or WebP". */
function typeNames(accept: readonly string[]): string {
  const names = accept.map((t) => TYPE_NAMES[t] ?? t);
  return names.length > 1 ? `${names.slice(0, -1).join(', ')} or ${names[names.length - 1]}` : names[0] ?? '';
}

/** "3.2 MB", "2 MB", "800 KB". */
function sizeOf(bytes: number): string {
  const mb = bytes / (1024 * 1024);
  if (mb >= 1) return `${Number(mb.toFixed(1))} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

/** Why `file` is refused here, or null. */
function refusal(file: File, accept: readonly string[], maxBytes: number | undefined): string | null {
  if (!accept.includes(file.type)) return `Choose a ${typeNames(accept)} image.`;
  if (maxBytes != null && file.size > maxBytes) return `That image is ${sizeOf(file.size)}; the most is ${sizeOf(maxBytes)}.`;
  return null;
}

export function ImageField({ label, src, name, accept = IMAGE_TYPES, maxBytes, onPick, onRemove, message, uploadLabel = 'Upload image', ground, onGroundChange }: ImageFieldProps) {
  const id = useId();
  const labelId = `${id}-label`;
  const messageId = `${id}-message`;
  const input = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<'upload' | 'remove' | null>(null);

  // In a form, its work holds the form: nothing is saved without it.
  const form = useFormState();
  const run = async (which: 'upload' | 'remove', work: () => void | Promise<unknown>) => {
    setBusy(which);
    setError(null);
    const release = form.hold();
    try {
      await work();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      release();
      setBusy(null);
    }
  };

  const picked = (e: JSX.TargetedEvent<HTMLInputElement>) => {
    const file = e.currentTarget.files?.[0];
    // The same file can be picked again after a refusal.
    e.currentTarget.value = '';
    if (!file) return;
    const why = refusal(file, accept, maxBytes);
    if (why) {
      setError(why);
      return;
    }
    void run('upload', () => onPick(file));
  };

  const shown = error ?? message;
  return (
    <div {...field({ invalid: error !== null })}>
      <span data-slot="label" id={labelId}>{label}</span>
      <div data-slot="picker" role="group" aria-labelledby={labelId} aria-describedby={shown ? messageId : undefined}>
        <Thumbnail label={name} src={src ?? undefined} size="lg" ground={ground} />
        <div data-slot="buttons">
          <ActionButton kind="upload" type="button" busy={busy === 'upload'} disabled={busy !== null} onClick={() => input.current?.click()}>
            {uploadLabel}
          </ActionButton>
          {src && onRemove && <ActionButton kind="remove" busy={busy === 'remove'} disabled={busy !== null} onClick={() => void run('remove', onRemove)} />}
          {onGroundChange && (
            <Switch label="Background" checked={ground === 'padded'} onCheckedChange={(on) => onGroundChange(on ? 'padded' : 'none')} />
          )}
        </div>
        <input ref={input} type="file" accept={accept.join(',')} hidden onChange={picked} />
      </div>
      <FieldMessage id={messageId} message={shown} length={0} alert={error !== null} />
    </div>
  );
}
