// <ConfirmAction>: a destructive action that asks once, in place. The first
// press shows the question and its two answers where the action was; the
// confirming one takes focus; Cancel or Escape steps back and returns focus.
import { useEffect, useRef, useState } from 'preact/hooks';
import { confirmAction } from '@boogy/web';
import { Button } from './button';
import { ACTIONS, type ButtonSize } from '@boogy/web';
import { ActionButton } from './action-button';
import type { GlyphShape } from './glyphs';

export type ConfirmActionProps = {
  /** The action's name: the first button's words ("Delete"). */
  label: string;
  /** What is asked ("Delete this message?"). */
  question: string;
  /** The confirming button's words. Default the label. */
  confirmLabel?: string;
  cancelLabel?: string;
  /** The first button's glyph, if any. */
  glyph?: GlyphShape;
  /** The first button is its glyph alone, named by `label` (a row of
   *  messages, say, where words on every row would crowd it). */
  iconOnly?: boolean;
  size?: ButtonSize;
  onConfirm: () => void | Promise<void>;
};

export function ConfirmAction({ label, question, confirmLabel = label, cancelLabel = ACTIONS.cancel.label, glyph, iconOnly = false, size = 'sm', onConfirm }: ConfirmActionProps) {
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  const yes = useRef<HTMLButtonElement>(null);
  const first = useRef<HTMLButtonElement>(null);
  const wasAsking = useRef(false);
  useEffect(() => {
    if (asking) yes.current?.focus();
    else if (wasAsking.current) first.current?.focus();
    wasAsking.current = asking;
  }, [asking]);
  const confirm = async () => {
    setBusy(true);
    try { await onConfirm(); } finally { setBusy(false); setAsking(false); }
  };
  return (
    <span {...confirmAction({ asking })} onKeyDown={(e) => { if (asking && e.key === 'Escape') { e.preventDefault(); setAsking(false); } }}>
      {asking ? (
        <>
          <span data-slot="question">{question}</span>
          <span data-slot="answers">
            {/* The SDK's Delete and Cancel, in the confirming words. */}
            {/* Its own words throughout ("Remove"), disabled while it runs. */}
            <ActionButton ref={yes} kind="delete" type="button" size={size} disabled={busy} onClick={confirm}>{confirmLabel}</ActionButton>
            <ActionButton kind="cancel" size={size} disabled={busy} onClick={() => setAsking(false)}>{cancelLabel}</ActionButton>
          </span>
        </>
      ) : (
        iconOnly && glyph ? (
          <Button ref={first} variant="quiet" size={size} shape="icon" glyph={glyph} label={label} onClick={() => setAsking(true)} />
        ) : (
          <Button ref={first} variant="quiet" size={size} glyph={glyph} onClick={() => setAsking(true)}>{label}</Button>
        )
      )}
    </span>
  );
}
