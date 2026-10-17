// ConfirmAction: a destructive action that asks once, in place ("Delete?
// Delete · Cancel"), rather than in a dialog that covers what is being acted on.

export interface ConfirmActionAttrs {
  'data-boogy': 'confirm-action';
  /** It is asking: the question and its two answers are shown. */
  'data-asking'?: '';
}

export function confirmAction({ asking = false }: { asking?: boolean } = {}): ConfirmActionAttrs {
  const attrs: ConfirmActionAttrs = { 'data-boogy': 'confirm-action' };
  if (asking) attrs['data-asking'] = '';
  return attrs;
}
