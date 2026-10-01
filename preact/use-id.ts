import { useRef } from 'preact/hooks';

let nextId = 0;

/** An id for this component instance, stable across its renders and unique on
 *  the page — for wiring one element to another (`aria-controls`,
 *  `aria-labelledby`). */
export const useId = (prefix: string): string => useRef(`${prefix}${++nextId}`).current;
