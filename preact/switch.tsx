import type { JSX } from 'preact';
import { switchControl } from '@boogy/web';

export type SwitchProps = { checked: boolean; onCheckedChange(next: boolean): void; label: string; /** Cannot be pressed, and looks it. */ disabled?: boolean } & Omit<JSX.HTMLAttributes<HTMLButtonElement>, 'onChange' | 'role' | 'type'>;

/** A labelled on/off control. See `switchControl()`. */
export function Switch({ checked, onCheckedChange, label, onClick, ...rest }: SwitchProps) {
  return (
    <button {...rest} {...switchControl(checked)} onClick={(e) => {
        // The consumer's own handler runs first; preventing default keeps the switch as it was.
        (onClick as ((e: MouseEvent) => void) | undefined)?.(e);
        if (!e.defaultPrevented) onCheckedChange(!checked);
      }}>
      <span data-slot="track" aria-hidden="true"><span data-slot="thumb" /></span>
      <span data-slot="label">{label}</span>
    </button>
  );
}
