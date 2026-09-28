export interface LayoutViolation {
  element: Element;
  rule: 'fluid-needs-surface';
  message: string;
}

/**
 * `fluid` has no ceiling, so it is legal only on an element that owns its own
 * box — made checkable as "is a sizing container". Anything sharing a line or
 * row with other content must be `clamped` or `fixed`.
 */
export function findLayoutViolations(root: ParentNode): LayoutViolation[] {
  return Array.from(root.querySelectorAll('[data-u-policy="fluid"]:not([data-surface])')).map((element) => {
    const name = element.getAttribute('data-component') ?? `<${element.tagName.toLowerCase()}>`;
    return {
      element,
      rule: 'fluid-needs-surface',
      message: `${name}: policy "fluid" is only allowed on a surface (an element that owns its box). Use "clamped", or make it a surface.`,
    };
  });
}
