// <Form> (see `form()` in the core package): a form for a screen. Its fields
// scroll in its body; its actions stay in its foot. While `onSubmit` runs, the
// form is busy: its primary action says so (Saving…) and no action can be
// pressed (a Cancel then would race the save); one that throws shows why in the
// foot until the next try. A field still at work (an image uploading) holds
// the form: it submits nothing until the work is in.
import { createContext, type ComponentChildren, type JSX } from 'preact';
import { useContext, useEffect, useRef, useState } from 'preact/hooks';
import { form } from '@boogy/web';
import { Notice } from './notice';

interface FormStateValue {
  submitting: boolean;
  /** Fields at work (an upload): the form submits nothing meanwhile. */
  holds: number;
  /** Hold the form while some work runs; call what it returns when done. */
  hold: () => () => void;
}

const FormState = createContext<FormStateValue>({ submitting: false, holds: 0, hold: () => () => {} });

/** The form around the caller: submitting, held, and how to hold it (an
 *  inert one outside a form). */
export function useFormState(): FormStateValue {
  return useContext(FormState);
}

export type FormProps = {
  /** Runs on submit (Enter in a field, or the primary action). Throw to
   *  refuse: the error's message is shown in the foot. */
  onSubmit: () => void | Promise<unknown>;
  /** The foot's actions: `ActionButton`s (Cancel, Save; Delete first). */
  actions: ComponentChildren;
  /** The fields. */
  children?: ComponentChildren;
} & Omit<JSX.HTMLAttributes<HTMLFormElement>, 'onSubmit' | 'action' | 'children'>;

export function Form({ onSubmit, actions, children, ...rest }: FormProps) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const running = useRef(false);
  const [holds, setHolds] = useState(0);
  const held = useRef(0);
  const hold = () => {
    held.current += 1;
    setHolds(held.current);
    let released = false;
    return () => {
      if (released) return;
      released = true;
      held.current -= 1;
      if (live.current) setHolds(held.current);
    };
  };
  const live = useRef(true);
  useEffect(() => () => { live.current = false; }, []);
  const submit = async (e: JSX.TargetedEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (running.current || held.current > 0) return;
    running.current = true;
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit();
    } catch (err) {
      if (live.current) setError(err instanceof Error ? err.message : String(err));
    } finally {
      running.current = false;
      if (live.current) setSubmitting(false);
    }
  };
  return (
    <FormState.Provider value={{ submitting, holds, hold }}>
      <form {...rest} {...form()} onSubmit={submit} aria-busy={submitting ? 'true' : undefined}>
        <div data-slot="body">
          <div data-slot="fields">{children}</div>
        </div>
        <div data-slot="foot">
          <div data-slot="actions">
            {error && <Notice tone="danger">{error}</Notice>}
            {actions}
          </div>
        </div>
      </form>
    </FormState.Provider>
  );
}
