// actionButton: the actions every app has (Save, Cancel, Delete…), each one
// definition: its words, what it says while it runs, its look, and its role.
// A kind's role places it: in a form's foot (and a sheet's), a destructive
// action goes first, at the start, and the others to the end. Apps name the
// kind and never set a variant or a label of their own for these.
import type { ButtonVariant } from './button';

export const ACTION_KINDS = ['save', 'create', 'add', 'send', 'accept', 'confirm', 'done', 'upload', 'cancel', 'close', 'decline', 'delete', 'remove', 'discard', 'archive', 'unarchive'] as const;
export type ActionKind = (typeof ACTION_KINDS)[number];

/** `primary`: what the form or step is for (it submits); `secondary`: leaving
 *  it be; `destructive`: taking something away. */
export type ActionRole = 'primary' | 'secondary' | 'destructive';

export interface ActionSpec {
  label: string;
  /** What it says while it runs (a save on its way). */
  busyLabel: string;
  variant: ButtonVariant;
  role: ActionRole;
  /** An SDK glyph beside the words. */
  glyph?: 'plus' | 'send' | 'trash' | 'upload' | 'archive';
}

const primary = (label: string, busyLabel: string, glyph?: ActionSpec['glyph']): ActionSpec => ({ label, busyLabel, variant: 'solid', role: 'primary', glyph });
const secondary = (label: string): ActionSpec => ({ label, busyLabel: label, variant: 'quiet', role: 'secondary' });

export const ACTIONS: Readonly<Record<ActionKind, ActionSpec>> = {
  save: primary('Save', 'Saving…'),
  create: primary('Create', 'Creating…'),
  add: primary('Add', 'Adding…', 'plus'),
  send: primary('Send', 'Sending…', 'send'),
  accept: primary('Accept', 'Accepting…'),
  confirm: primary('Confirm', 'Confirming…'),
  done: primary('Done', 'Finishing…'),
  // Picks a file and sends it: a soft fill, beside the thing it changes.
  upload: { label: 'Upload', busyLabel: 'Uploading…', variant: 'soft', role: 'secondary', glyph: 'upload' },
  cancel: secondary('Cancel'),
  close: secondary('Close'),
  decline: secondary('Decline'),
  // Destroys what it names: red, and first in a foot, apart from the rest.
  delete: { label: 'Delete', busyLabel: 'Deleting…', variant: 'danger', role: 'destructive', glyph: 'trash' },
  // Takes something off (an image, a member) that can be put back: quiet.
  remove: { label: 'Remove', busyLabel: 'Removing…', variant: 'quiet', role: 'destructive' },
  // Throws away unsaved work.
  discard: { label: 'Discard', busyLabel: 'Discarding…', variant: 'danger', role: 'destructive' },
  // Sets a thing aside, still there to read and to bring back: quiet, and
  // first in a foot, as taking something away is.
  archive: { label: 'Archive', busyLabel: 'Archiving…', variant: 'quiet', role: 'destructive', glyph: 'archive' },
  unarchive: { label: 'Unarchive', busyLabel: 'Unarchiving…', variant: 'quiet', role: 'secondary', glyph: 'archive' },
};

export interface ActionButtonAttrs {
  'data-action': ActionKind;
  'data-role': ActionRole;
}

export function actionButton(kind: ActionKind): ActionButtonAttrs {
  const spec = ACTIONS[kind];
  if (!spec) throw new Error(`actionButton(): kind must be one of ${ACTION_KINDS.join(', ')}, got "${kind}"`);
  return { 'data-action': kind, 'data-role': spec.role };
}
