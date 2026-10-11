// Accordion: items that open and close in place, each a header over its
// content — a menu of groups, a set of questions, sections of settings. Each
// item is the browser's own details/summary, so a press, Enter and Space open
// and close it with no script, and assistive technology announces it as
// expandable. Up, Down, Home and End move between the headers of one level. A
// second level is another Accordion inside an item's content, a step quieter.
export interface AccordionAttrs { 'data-boogy': 'accordion' }
export function accordion(): AccordionAttrs { return { 'data-boogy': 'accordion' }; }
