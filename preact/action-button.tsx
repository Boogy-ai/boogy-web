// <ActionButton> (see `actionButton()` in the core package): Save, Cancel,
// Delete and the rest, each by its kind: its words, its look, its glyph and
// its role come from the one table, never from the app. A primary action
// submits its form (unless given another `type`) and is busy while the form
// submits; in a form, no action can be pressed while it submits, nor a primary
// one while a field holds it (an upload). Any action is busy when told
// (`busy`), saying so (Deleting…). Its ref reaches the button (to focus it).
import type { ComponentChildren, JSX, Ref } from 'preact';
import { forwardRef } from 'preact/compat';
import { ACTIONS, actionButton, type ActionKind, type ButtonSize } from '@boogy/web';
import { Button } from './button';
import { useFormState } from './form';

export type ActionButtonProps = {
  kind: ActionKind;
  /** Running: it says so and cannot be pressed. */
  busy?: boolean;
  /** Its own words in place of the kind's ("Delete room"). */
  children?: ComponentChildren;
  size?: ButtonSize;
  /** Take the whole width of its container. */
  fill?: boolean;
  /** The kind's glyph alone, its words as its name (a short row, a strip).
   *  Only a kind that has a glyph. */
  iconOnly?: boolean;
} & Omit<JSX.ButtonHTMLAttributes<HTMLButtonElement>, 'size' | 'children'>;

function ActionButtonImpl({ kind, busy, children, size, fill, iconOnly = false, disabled, type, ...rest }: ActionButtonProps, ref: Ref<HTMLElement>) {
  const spec = ACTIONS[kind];
  if (iconOnly && !spec.glyph) throw new Error(`ActionButton: "${kind}" has no glyph to show alone; drop iconOnly`);
  if (iconOnly && children != null && typeof children !== 'string') {
    throw new Error('ActionButton: an iconOnly button is named by plain words; give it a string, or no children for its kind\'s words');
  }
  const form = useFormState();
  const primary = spec.role === 'primary';
  const running = !!busy || (primary && form.submitting);
  const held = form.submitting || (primary && form.holds > 0);
  const common = {
    ref,
    ...(rest as object),
    ...actionButton(kind),
    type: type ?? (spec.role === 'primary' ? 'submit' : 'button'),
    variant: spec.variant,
    size,
    fill,
    glyph: spec.glyph,
    disabled: !!disabled || running || held,
    'aria-busy': running ? ('true' as const) : undefined,
  };
  if (iconOnly) {
    // Its words, or its busy words, are its name.
    const name = running ? spec.busyLabel : typeof children === 'string' ? children : spec.label;
    return <Button {...common} shape="icon" label={name} />;
  }
  return <Button {...common}>{running ? spec.busyLabel : children ?? spec.label}</Button>;
}

export const ActionButton = forwardRef(ActionButtonImpl) as unknown as (props: ActionButtonProps & { ref?: Ref<HTMLElement> }) => JSX.Element;
