// Component styles, in their own cascade layer above the foundation's and below
// every app rule: an app's own CSS always wins without needing specificity.
// Every size is a multiple of the local --u and every colour a role token.

const PILL_CSS = `
  [data-boogy="pill"] {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-1);
    padding: 0 var(--space-2);
    border: none;
    border-radius: var(--radius-full);
    background: transparent;
    color: inherit;
    font: inherit;
    white-space: nowrap;
    transition: background-color var(--dur-fast) ease-out;
  }
  :is(button, a)[data-boogy="pill"]:not(:disabled, [aria-disabled="true"]) { cursor: pointer; }
  [data-boogy="pill"]:focus-visible {
    outline: var(--ring) solid var(--accent);
    outline-offset: var(--ring);
  }
  [data-boogy="pill"]:is(:disabled, [aria-disabled="true"]) { opacity: 0.45; }

  /* solid */
  [data-boogy="pill"][data-variant="solid"] { background: var(--fill-hover); }
  [data-boogy="pill"][data-variant="solid"]:not(:disabled, [aria-disabled="true"]):hover { background: var(--fill-selected); }
  [data-boogy="pill"][data-variant="solid"]:not(:disabled, [aria-disabled="true"]):active {
    background: color-mix(in oklch, var(--text-1) 18%, transparent);
  }
  [data-boogy="pill"][data-variant="solid"][aria-pressed="true"] { background: var(--accent-soft); }

  /* transparent: no shape in any state; the focus ring above still applies */

  /* ghost: the solid shape, only while pointed at or keyboard-focused */
  [data-boogy="pill"][data-variant="ghost"]:not(:disabled, [aria-disabled="true"]):is(:hover, :focus-visible) {
    background: var(--fill-hover);
  }
`;

const BUTTON_CSS = `
  [data-boogy="button"] {
    --_h: var(--control-md);
    box-sizing: border-box;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-2);
    height: var(--_h);
    padding: 0 var(--space-3);
    border: none;
    border-radius: var(--radius-1);
    background: transparent;
    color: inherit;
    font: inherit;
    font-size: var(--fs-detail);
    line-height: 1;
    white-space: nowrap;
    text-decoration: none;
    cursor: pointer;
    transition: background-color var(--dur-fast) ease-out, color var(--dur-fast) ease-out;
  }
  [data-boogy="button"][data-size="sm"] { --_h: var(--control-sm); padding: 0 var(--space-2); }
  [data-boogy="button"][data-shape="icon"] { width: var(--_h); padding: 0; }
  [data-boogy="button"][data-rounded="true"] { border-radius: var(--radius-full); }
  [data-boogy="button"]:focus-visible {
    outline: var(--ring) solid var(--accent);
    outline-offset: var(--ring);
  }
  [data-boogy="button"]:is(:disabled, [aria-disabled="true"]) { opacity: 0.45; cursor: default; }
  /* A finger does not shrink with the unit: on a touch screen every button is
     at least 44px. A device capability, not a layout breakpoint. */
  @media (pointer: coarse) {
    [data-boogy="button"] { min-height: var(--touch-min); }
    [data-boogy="button"][data-shape="icon"] { min-width: var(--touch-min); }
  }

  /* solid */
  [data-boogy="button"][data-variant="solid"] {
    background: var(--accent);
    color: oklch(from var(--accent) 0.2 calc(c * 0.3) h);
    font-weight: 600;
  }
  [data-boogy="button"][data-variant="solid"]:not(:disabled, [aria-disabled="true"]):hover { background: var(--accent-hover); }
  [data-boogy="button"][data-variant="solid"]:not(:disabled, [aria-disabled="true"]):active {
    background: oklch(from var(--accent) calc(l - 0.06) c h);
  }

  /* quiet */
  [data-boogy="button"][data-variant="quiet"] { color: var(--text-2); }
  [data-boogy="button"][data-variant="quiet"]:not(:disabled, [aria-disabled="true"]):hover { background: var(--fill-hover); color: var(--text-1); }
  [data-boogy="button"][data-variant="quiet"]:not(:disabled, [aria-disabled="true"]):active { background: var(--fill-selected); }
  [data-boogy="button"][data-variant="quiet"][aria-pressed="true"] { background: var(--fill-selected); color: var(--text-1); }

  /* outline: an edge on no fill at rest; hover lights the fill slightly and
     brightens the edge and the text (a wide text-3 → text-1 step, so an icon
     visibly comes up). Edge colours are tokens, so an app can match its own. */
  [data-boogy="button"][data-variant="outline"] {
    /* Fallbacks, not declarations here: an app sets these on any ancestor. */
    border: 1px solid var(--button-outline-edge, var(--edge));
    color: var(--text-3);
    transition: border-color var(--dur-fast) ease-out, color var(--dur-fast) ease-out, background-color var(--dur-fast) ease-out;
  }
  [data-boogy="button"][data-variant="outline"]:not(:disabled, [aria-disabled="true"]):hover {
    border-color: var(--button-outline-edge-hover, var(--edge-strong));
    background: var(--fill-hover);
    color: var(--text-1);
  }
  [data-boogy="button"][data-variant="outline"]:not(:disabled, [aria-disabled="true"]):active {
    border-color: var(--text-2);
  }

  /* danger */
  [data-boogy="button"][data-variant="danger"] { color: var(--danger); }
  [data-boogy="button"][data-variant="danger"]:not(:disabled, [aria-disabled="true"]):hover {
    background: color-mix(in oklch, var(--danger) 16%, transparent);
  }
  [data-boogy="button"][data-variant="danger"]:not(:disabled, [aria-disabled="true"]):active {
    background: color-mix(in oklch, var(--danger) 26%, transparent);
  }
`;

// Drawer breakpoints: the container width at which the drawer docks. Fixed
// values, because a container query's condition cannot read a custom property.
export const DRAWER_BREAKPOINTS = { sm: '40rem', md: '48rem', lg: '64rem' } as const;

const DRAWER_DOCKED = (at: string) => `
  @container boogy-drawer (min-width: ${DRAWER_BREAKPOINTS[at as keyof typeof DRAWER_BREAKPOINTS]}) {
    [data-boogy="drawer-layout"][data-collapse-at="${at}"] > [data-boogy="drawer"] {
      --boogy-drawer-mode: docked;
      position: relative;
      inset: auto;
      z-index: auto;
      width: var(--drawer-width);
      translate: none;
      visibility: visible;
      box-shadow: none;
      border-inline-end: var(--rule);
      transition: width var(--dur-base) ease-out;
    }
    [data-collapse-at="${at}"][data-side="end"] > [data-boogy="drawer"] {
      border-inline-end: none;
      border-inline-start: var(--rule);
    }
    [data-collapse-at="${at}"][data-expanded="false"] > [data-boogy="drawer"] { width: var(--drawer-strip-width); }
    /* On the strip the ENTRY is the tile — filled at rest, the size of its
       mark — so there is one box, never a box inside a hover box. Hover only
       brightens what is inside it (the base :hover sets the same fill). */
    [data-collapse-at="${at}"][data-expanded="false"] > [data-boogy="drawer"] [data-boogy="drawer-item"] {
      justify-content: center;
      width: var(--mark-lg);
      min-height: var(--mark-lg);
      margin-inline: auto;
      padding-inline: 0;
      background: var(--fill-hover);
    }
    [data-collapse-at="${at}"][data-expanded="false"] > [data-boogy="drawer"] [data-boogy="drawer-item"][aria-current="page"] { background: var(--fill-selected); }
    /* framed: the mark is already the tile, so the entry stays surfaceless. */
    [data-collapse-at="${at}"][data-expanded="false"] > [data-boogy="drawer"] [data-boogy="drawer-item"][data-variant="framed"] { background: transparent; }
    /* The strip's head is the toggle: the title entry gives its place to it,
       logo included, rather than stacking a second mark above the entries. */
    [data-collapse-at="${at}"][data-expanded="false"] > [data-boogy="drawer"] [data-boogy="drawer-item"][data-variant="title"] {
      display: none;
    }
    [data-collapse-at="${at}"][data-expanded="false"] > [data-boogy="drawer"] [data-slot="label"] {
      position: absolute;
      width: 1px;
      height: 1px;
      overflow: hidden;
      clip-path: inset(50%);
      white-space: nowrap;
    }
    [data-collapse-at="${at}"] > [data-boogy="drawer-backdrop"] { display: none; }
    /* Resizable: the handle IS the drawer's edge, drawn once. */
    [data-collapse-at="${at}"][data-resizable="true"][data-expanded="true"] > [data-boogy="drawer-resizer"] { display: block; }
    [data-collapse-at="${at}"][data-resizable="true"][data-expanded="true"] > [data-boogy="drawer"] { border-inline: none; }
  }
`;

const DRAWER_CSS = `
  /* The layout: the drawer beside (docked) or over (overlay) the main area.
     Its own container, so the mode follows the space it is given, not the
     viewport. Overlay is the default; the breakpoint query docks it. */
  [data-boogy="drawer-layout"] {
    /* The drawer's own dimensions, defined once. The strip holds one large
       mark with the drawer's padding either side. */
    --drawer-width: calc(var(--u) * 15);
    --drawer-overlay-width: calc(var(--u) * 18);
    --drawer-strip-width: calc(var(--mark-lg) + 2 * var(--space-2) + 1px); /* + the 1px edge: the drawer is border-box */
    /* The framed entry's mark tile. An app themes it by redefining these on
       the drawer (e.g. to match its own panels). */
    --drawer-mark-ground: var(--ground);
    --drawer-mark-edge: var(--edge);
    --drawer-mark-edge-hover: var(--edge-strong);
    --drawer-mark-edge-current: var(--text-3);
    --drawer-mark-radius: var(--radius-2);
    /* The resize handle's hairline, at rest and under the pointer. */
    --drawer-edge: var(--edge);
    --drawer-edge-hover: var(--edge-strong);
    container: boogy-drawer / inline-size;
    position: relative;
    display: flex;
    min-height: 0;
    overflow: hidden;
  }
  [data-boogy="drawer-layout"][data-side="end"] { flex-direction: row-reverse; }
  [data-boogy="drawer-main"] { flex: 1 1 auto; min-width: 0; min-height: 0; }

  [data-boogy="drawer"] {
    --boogy-drawer-mode: overlay;
    box-sizing: border-box;
    position: absolute;
    z-index: 20;
    inset-block: 0;
    inset-inline-start: 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    width: min(85%, var(--drawer-overlay-width));
    padding: var(--space-2);
    overflow-x: hidden;
    overflow-y: auto;
    background: var(--ground-raised);
    box-shadow: var(--overlay-shadow);
    translate: -100% 0;
    visibility: hidden;
    transition: translate var(--dur-base) ease-out, visibility 0s linear var(--dur-base);
  }
  [data-boogy="drawer-layout"][data-side="end"] > [data-boogy="drawer"] {
    inset-inline-start: auto;
    inset-inline-end: 0;
    translate: 100% 0;
  }
  [data-boogy="drawer-layout"][data-open="true"] > [data-boogy="drawer"] {
    translate: none;
    visibility: visible;
    transition: translate var(--dur-base) ease-out;
  }
  [data-boogy="drawer-backdrop"] {
    position: absolute;
    z-index: 19;
    inset: 0;
    background: color-mix(in oklch, black 45%, transparent);
    opacity: 0;
    pointer-events: none;
    transition: opacity var(--dur-base) ease-out;
  }
  [data-boogy="drawer-layout"][data-open="true"] > [data-boogy="drawer-backdrop"] {
    opacity: 1;
    pointer-events: auto;
  }

  /* An entry: a mark (icon, monogram or any component) and a label. */
  [data-boogy="drawer-item"] {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    min-height: var(--control-lg);
    padding: var(--space-1) var(--space-2);
    border: none;
    border-radius: var(--radius-2);
    background: transparent;
    color: var(--text-2);
    font: inherit;
    font-size: var(--fs-detail);
    text-align: start;
    text-decoration: none;
    cursor: pointer;
  }
  [data-boogy="drawer-item"]:hover { background: var(--fill-hover); color: var(--text-1); }
  [data-boogy="drawer-item"]:focus-visible {
    outline: var(--ring) solid var(--accent);
    outline-offset: calc(var(--ring) * -1);
  }
  [data-boogy="drawer-item"][aria-current="page"] {
    background: var(--fill-selected);
    color: var(--text-1);
    font-weight: 600;
  }
  /* A finger does not shrink with the unit (as for buttons): 44px on touch. */
  @media (pointer: coarse) {
    [data-boogy="drawer-item"] { min-height: var(--touch-min); }
  }
  /* A mark draws no surface of its own: the entry's surface (its hover and
     current fill, or the tile on the strip) is the only box. */
  [data-boogy="drawer-item"] > [data-slot="mark"] {
    flex: none;
    display: grid;
    place-items: center;
    width: var(--mark-lg);
    height: var(--mark-lg);
    font-size: var(--fs-caption);
    font-weight: 600;
    letter-spacing: 0.02em;
  }
  /* framed: the mark is a small panel (ground + edge, themeable) and is the
     entry's ONLY box — the row draws no hover or current surface around it.
     Hover brightens the letters (the base :hover colour) and the edge;
     current takes the strongest edge and the bold label. */
  [data-boogy="drawer-item"][data-variant="framed"] > [data-slot="mark"] {
    box-sizing: border-box;
    border: 1px solid var(--drawer-mark-edge);
    border-radius: var(--drawer-mark-radius);
    background: var(--drawer-mark-ground);
  }
  [data-boogy="drawer-item"][data-variant="framed"]:is(:hover, [aria-current="page"]) {
    background: transparent;
  }
  [data-boogy="drawer-item"][data-variant="framed"]:hover > [data-slot="mark"] {
    border-color: var(--drawer-mark-edge-hover);
  }
  [data-boogy="drawer-item"][data-variant="framed"][aria-current="page"] > [data-slot="mark"] {
    border-color: var(--drawer-mark-edge-current);
  }
  /* The title entry: the drawer's heading, larger than the entries. Its mark
     is 2.25 units, which is exactly the collapsed strip's inner width. */
  [data-boogy="drawer-item"][data-variant="title"] {
    min-height: max(var(--touch-min), var(--control-lg));
    color: var(--text-1);
    font-size: var(--fs-title);
    font-weight: 600;
  }
  [data-boogy="drawer-item"][data-variant="title"] > [data-slot="mark"] {
    width: var(--mark-lg);
    height: var(--mark-lg);
    font-size: var(--fs-body);
  }
  /* The toggle's default glyph: one step up from an entry's icon, pointing
     where the drawer will go when pressed. */
  [data-role="drawer-toggle"] > [data-slot="chevron"] {
    width: var(--icon-md);
    height: var(--icon-md);
    flex: none;
  }
  [data-role="drawer-toggle"][aria-expanded="false"] > [data-slot="chevron"] { scale: -1 1; }
  [data-side="end"] [data-role="drawer-toggle"] > [data-slot="chevron"] { scale: -1 1; }
  [data-side="end"] [data-role="drawer-toggle"][aria-expanded="false"] > [data-slot="chevron"] { scale: 1 1; }
  [data-boogy="drawer-item"] > [data-slot="label"] {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  /* The resize handle: a 1px hairline in the drawer's place of a border, with
     a hit area widened past it on both sides, brightening under the pointer,
     on focus and while dragged. Shown only docked and expanded (above). */
  [data-boogy="drawer-resizer"] {
    display: none;
    position: relative;
    z-index: 1;
    flex: none;
    order: 1;
    width: 1px;
    background: var(--drawer-edge);
    cursor: col-resize;
    touch-action: none;
  }
  [data-boogy="drawer-resizer"]::before {
    content: "";
    position: absolute;
    inset-block: 0;
    inset-inline: calc(var(--space-1) * -1);
  }
  [data-boogy="drawer-resizer"]:is(:hover, :focus-visible, [data-active="true"]) {
    background: var(--drawer-edge-hover);
  }
  [data-boogy="drawer-resizer"]:focus-visible { outline: none; }
  [data-boogy="drawer-layout"][data-resizable="true"] > [data-boogy="drawer-main"] { order: 2; }
${Object.keys(DRAWER_BREAKPOINTS).map(DRAWER_DOCKED).join('')}
  /* A dragged edge follows the pointer; a width transition would trail it. */
  [data-boogy="drawer-layout"][data-resizing="true"] > [data-boogy="drawer"] { transition: none; }
  /* animate: false — every state change is instant. Last, and at the docked
     rules' specificity, so it wins over each transition set above. */
  [data-boogy="drawer-layout"][data-animate="false"] > :is([data-boogy="drawer"], [data-boogy="drawer-backdrop"]) {
    transition: none;
  }
`;

// Popover: rendered in the browser's top layer (the `popover` attribute), so
// no ancestor's overflow or stacking can clip or cover it. `place()` computes
// its left/top/max-height; this sheet undoes the UA's centred-dialog defaults
// and draws the surface. `page` mode is the small-screen form: the whole
// screen, a head with a back button, a scrolling body.
const POPOVER_CSS = `
  [data-boogy="popover"] {
    box-sizing: border-box;
    position: fixed;
    inset: auto;
    margin: 0;
    padding: 0;
    max-width: calc(100vw - 2 * var(--space-3));
    overflow: auto;
    border: 1px solid var(--popover-edge, var(--edge));
    border-radius: var(--radius-2);
    background: var(--popover-ground, var(--ground-raised));
    color: var(--text-1);
    box-shadow: var(--overlay-shadow);
    opacity: 1;
    scale: 1;
    transition: opacity var(--dur-base) ease-out, scale var(--dur-base) ease-out;
  }
  @starting-style {
    [data-boogy="popover"] { opacity: 0; scale: 0.96; }
  }
  @media (prefers-reduced-motion: reduce) {
    [data-boogy="popover"] { transition: none; }
  }
  [data-boogy="popover"][data-mode="page"] {
    inset: 0;
    width: 100%;
    height: 100%;
    max-width: none;
    max-height: none;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    border: none;
    border-radius: 0;
    box-shadow: none;
    background: var(--popover-ground, var(--ground));
  }
  /* The head, in every mode that has one; the body scrolls beneath it. */
  [data-boogy="popover"]:has(> [data-slot="head"]) { display: flex; flex-direction: column; overflow: hidden; }
  [data-boogy="popover"] > [data-slot="head"] {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    min-height: var(--control-lg);
    padding: var(--space-2);
    border-bottom: var(--rule);
    font-size: var(--fs-title);
    font-weight: 600;
  }
  [data-boogy="popover"] > [data-slot="head"] > [data-slot="title"] { flex: 1 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  [data-boogy="popover"] > [data-slot="body"] { flex: 1 1 auto; min-height: 0; overflow: auto; }
`;

// Menu: the ARIA menu pattern (React Aria's, under HeroUI v3's Dropdown). An
// item is a grid — label over description on the left, a shortcut hint and the
// selection indicator on the right — so any of the four may be absent. The
// focused item (keyboard or pointer: the menu moves focus on hover) takes the
// hover fill; there is no separate hover look to fall out of step with it.
const MENU_CSS = `
  [data-boogy="menu"] {
    --menu-min-width: calc(var(--u) * 12);
    display: flex;
    flex-direction: column;
    gap: 1px;
    min-width: max(var(--trigger-width, 0px), var(--menu-min-width));
    padding: var(--space-1);
    outline: none;
  }
  [data-boogy="menu-item"] {
    display: grid;
    grid-template-columns: 1fr auto auto;
    grid-template-areas: "label kbd indicator" "description kbd indicator";
    align-items: center;
    column-gap: var(--space-3);
    min-height: var(--control-md);
    padding: var(--space-1) var(--space-2);
    border-radius: var(--radius-1);
    color: var(--text-1);
    font-size: var(--fs-detail);
    cursor: default;
    outline: none;
    user-select: none;
  }
  [data-boogy="menu-item"]:focus { background: var(--fill-hover); }
  [data-boogy="menu-item"][data-variant="danger"] { color: var(--danger); }
  [data-boogy="menu-item"][data-variant="danger"]:focus {
    background: color-mix(in oklch, var(--danger) 16%, transparent);
  }
  [data-boogy="menu-item"][data-disabled="true"] { opacity: 0.45; }
  [data-boogy="menu-item"] > [data-slot="label"] { grid-area: label; min-width: 0; }
  [data-boogy="menu-item"] > [data-slot="description"] {
    grid-area: description;
    color: var(--text-3);
    font-size: var(--fs-caption);
  }
  [data-boogy="menu-item"] > [data-slot="kbd"] {
    grid-area: kbd;
    color: var(--text-3);
    font-family: var(--font-mono);
    font-size: var(--fs-caption);
  }
  [data-boogy="menu-item"] > [data-slot="indicator"] {
    grid-area: indicator;
    display: grid;
    place-items: center;
    width: var(--icon-sm);
    height: var(--icon-sm);
  }
  [data-boogy="menu-section"] { display: flex; flex-direction: column; gap: 1px; }
  [data-boogy="menu-section"] > [data-slot="header"] {
    padding: var(--space-1) var(--space-2);
    color: var(--text-3);
    font-size: var(--fs-caption);
    font-weight: 600;
  }
  [data-boogy="menu-separator"] {
    height: 1px;
    margin: var(--space-1) 0;
    background: var(--edge);
  }
`;

const SHEET_CSS = `
  [data-boogy="sheet"] {
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    position: fixed;
    inset: 0;
    overflow: hidden;
    background: var(--ground);
    color: var(--text-1);
    font-family: var(--font-body);
    font-size: var(--fs-body);
    line-height: 1.5;
  }
  [data-boogy="sheet"] > [data-slot="head"] {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    min-height: var(--control-lg);
    padding: var(--space-2) var(--space-4);
    border-bottom: var(--rule);
    font-size: var(--fs-title);
    font-weight: 600;
  }
  [data-boogy="sheet"] > [data-slot="body"] {
    flex: 1 1 auto;
    min-height: 0;
    overflow: auto;
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
    padding: var(--space-4);
  }
  [data-boogy="sheet"] > [data-slot="foot"] {
    display: flex;
    justify-content: flex-end;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-3) var(--space-4);
    border-top: var(--rule);
  }
`;

const FIELD_CSS = `
  [data-boogy="field"] { display: flex; flex-direction: column; gap: var(--space-1); }
  [data-boogy="field"] > [data-slot="label"] {
    color: var(--text-2);
    font-size: var(--fs-detail);
  }
  [data-boogy="field"] > [data-slot="control"] {
    box-sizing: border-box;
    min-height: var(--control-md);
    padding: 0 var(--space-2);
    border: 1px solid var(--edge);
    border-radius: var(--radius-2);
    background: var(--ground-sunken);
    color: var(--text-1);
    font: inherit;
    box-shadow: var(--field-shadow);
    transition: border-color var(--dur-fast) ease-out;
  }
  [data-boogy="field"] > [data-slot="control"]:hover { border-color: var(--edge-strong); }
  [data-boogy="field"] > [data-slot="control"]:focus-visible {
    outline: var(--ring) solid var(--accent);
    outline-offset: 1px;
  }
  [data-boogy="field"] > [data-slot="control"]:disabled { opacity: 0.45; }
  /* One clear button: the field's own, never the browser's beside it. */
  [data-boogy="field"] [data-slot="control"]::-webkit-search-cancel-button { display: none; }
  /* A fixed prefix inside the control's frame (a site address before an
     editable path, say): the group carries the edge, the input inside it
     does not. */
  [data-boogy="field"] > [data-slot="group"] {
    display: flex;
    align-items: center;
    min-height: var(--control-md);
    border: 1px solid var(--edge);
    border-radius: var(--radius-2);
    background: var(--ground-sunken);
    box-shadow: var(--field-shadow);
    transition: border-color var(--dur-fast) ease-out;
  }
  [data-boogy="field"] > [data-slot="group"]:hover { border-color: var(--edge-strong); }
  [data-boogy="field"] > [data-slot="group"]:focus-within {
    outline: var(--ring) solid var(--accent);
    outline-offset: 1px;
  }
  [data-boogy="field"] > [data-slot="group"] > [data-slot="prefix"] {
    padding-inline-start: var(--space-2);
    color: var(--text-3);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    min-width: 0;
    flex: 0 1 auto;
  }
  /* A leading icon (a search glass, say): centred on the frame by flex rather
     than sitting on the text's baseline, with room before the text. */
  [data-boogy="field"] > [data-slot="group"] > [data-slot="icon"] {
    display: flex;
    flex: none;
    padding-inline: var(--space-2) var(--space-2);
    color: var(--text-3);
  }
  [data-boogy="field"] > [data-slot="group"] > [data-slot="suffix"] { display: flex; flex: none; }
  [data-boogy="field"] > [data-slot="group"] > [data-slot="control"] {
    flex: 1 1 auto;
    min-width: 0;
    min-height: var(--control-md);
    padding: 0 var(--space-2) 0 0;
    border: none;
    background: transparent;
    color: var(--text-1);
    font: inherit;
    outline: none;
  }
  [data-boogy="field"][data-invalid="true"] > [data-slot="group"] { border-color: var(--danger); }
  /* A pill. Its ends are half circles, so what sits at either end steps in
     further from them. */
  [data-boogy="field"][data-rounded="true"] > :is([data-slot="control"], [data-slot="group"]) { border-radius: var(--radius-full); }
  [data-boogy="field"][data-rounded="true"] > [data-slot="control"] { padding-inline: var(--space-3); }
  [data-boogy="field"][data-rounded="true"] > [data-slot="group"] > :is([data-slot="icon"], [data-slot="prefix"]) { padding-inline-start: var(--space-3); }
  [data-boogy="field"][data-rounded="true"] > [data-slot="group"] > [data-slot="control"] { padding-inline-end: var(--space-3); }
  [data-boogy="field"][data-rounded="true"] > [data-slot="group"] > [data-slot="suffix"] { padding-inline-end: var(--space-1); }
  [data-boogy="field"] > [data-slot="message"] {
    color: var(--text-3);
    font-size: var(--fs-caption);
  }
  [data-boogy="field"] > [data-slot="message"]:empty { display: none; }
  [data-boogy="field"][data-invalid="true"] > [data-slot="message"] { color: var(--danger); }
  [data-boogy="field"][data-invalid="true"] > [data-slot="control"] { border-color: var(--danger); }
`;

const SECTION_CSS = `
  /* The caption lines are trimmed to their letters (cap height down to the
     baseline), so every space around them is a token rather than the font's
     leading: without the trim a heading and the line under it sat a whole
     line's height apart. */
  [data-boogy="section"] { display: flex; flex-direction: column; gap: var(--space-2); }
  /* The heading, its action beside it, and a description under both. */
  [data-boogy="section"] > [data-slot="head"] {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: center;
    gap: var(--space-2);
  }
  [data-boogy="section"] > [data-slot="head"] > [data-slot="description"] {
    grid-column: 1 / -1;
    margin: 0;
    color: var(--text-3);
    font-size: var(--fs-caption);
    text-box: trim-both cap alphabetic;
  }
  [data-boogy="section"] > [data-slot="header"],
  [data-boogy="section"] > [data-slot="head"] > [data-slot="header"] {
    margin: 0;
    text-box: trim-both cap alphabetic;
    color: var(--text-3);
    font-size: var(--fs-caption);
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }
`;

// Thumbnail: a rounded-square slot. An image fills it; without one, the
// initials sit on one of eight tones (hue varies, lightness and chroma fixed,
// so every tone reads at the same weight in either scheme).
const THUMBNAIL_CSS = `
  [data-boogy="thumbnail"] {
    flex: none;
    display: inline-grid;
    place-items: center;
    overflow: hidden;
    /* Softened, not rounded: an app mark reads as a square. */
    border-radius: var(--radius-1);
    background: oklch(0.62 0.11 var(--thumb-hue, 250));
    color: oklch(0.98 0 0);
    font-weight: 600;
    line-height: 1;
    user-select: none;
  }
  [data-boogy="thumbnail"][data-size="sm"] { width: var(--thumb-sm); height: var(--thumb-sm); font-size: var(--fs-detail); }
  [data-boogy="thumbnail"][data-size="md"] { width: var(--thumb-md); height: var(--thumb-md); font-size: var(--fs-body); }
  [data-boogy="thumbnail"][data-size="lg"] { width: var(--thumb-lg); height: var(--thumb-lg); font-size: var(--fs-display); border-radius: var(--radius-2); }
  [data-boogy="thumbnail"][data-image="true"] { background: var(--fill-hover); }
  [data-boogy="thumbnail"] > img { width: 100%; height: 100%; object-fit: cover; }
  [data-boogy="thumbnail"][data-tone="0"] { --thumb-hue: 25; }
  [data-boogy="thumbnail"][data-tone="1"] { --thumb-hue: 70; }
  [data-boogy="thumbnail"][data-tone="2"] { --thumb-hue: 130; }
  [data-boogy="thumbnail"][data-tone="3"] { --thumb-hue: 170; }
  [data-boogy="thumbnail"][data-tone="4"] { --thumb-hue: 215; }
  [data-boogy="thumbnail"][data-tone="5"] { --thumb-hue: 260; }
  [data-boogy="thumbnail"][data-tone="6"] { --thumb-hue: 300; }
  [data-boogy="thumbnail"][data-tone="7"] { --thumb-hue: 340; }
`;

// Tile and TileGrid: cards in as many columns as fit. A tile's title clamps to
// two lines so a long name never makes one tile taller than its row.
const TILE_CSS = `
  [data-boogy="tile-grid"] {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(var(--tile-min), 1fr));
    gap: var(--space-2);
    margin: 0;
    padding: 0;
    list-style: none;
  }
  [data-boogy="tile"] {
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-1);
    width: 100%;
    padding: var(--space-2) var(--space-1);
    border: none;
    border-radius: var(--radius-2);
    background: transparent;
    color: inherit;
    font: inherit;
    text-align: center;
    text-decoration: none;
  }
  :is(button, a)[data-boogy="tile"] { cursor: pointer; }
  :is(button, a)[data-boogy="tile"]:hover { background: var(--fill-hover); }
  [data-boogy="tile"]:focus-visible { outline: var(--ring) solid var(--accent); outline-offset: 0; }
  [data-boogy="tile"] > [data-slot="title"] {
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
    overflow: hidden;
    max-width: 100%;
    overflow-wrap: anywhere;
    font-size: var(--fs-detail);
    font-weight: 500;
    line-height: 1.25;
  }
  [data-boogy="tile"] > [data-slot="subtitle"] {
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: var(--text-3);
    font-size: var(--fs-caption);
  }
`;

// List and ListItem: rows of media, text and at most one action. Every text
// line ends in an ellipsis and the action never shrinks, so a long name or
// description can never push the action out of the row.
/**
 * A control in an item's title is the item's own: it reads as the title, and
 * its press area covers the whole item, while the item's action (end, foot)
 * stays above it and keeps its own — two controls side by side, never one
 * inside the other. ONE definition for every item that offers it (list rows,
 * cards); each host puts its action above with `position: relative`.
 */
function titleControlCovers(host: string): string {
  return `
  ${host}:has([data-slot="title"] > :is(button, a)) { position: relative; }
  ${host}:has([data-slot="title"] > :is(button, a)):hover { background: var(--fill-hover); }
  ${host}:has([data-slot="title"] > :focus-visible) { outline: var(--ring) solid var(--accent); outline-offset: 0; }
  ${host} [data-slot="title"] > :is(button, a) {
    all: unset;
    display: block;
    max-width: 100%;
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    cursor: pointer;
  }
  ${host} [data-slot="title"] > :is(button, a)::after { content: ""; position: absolute; inset: 0; }`;
}

const LIST_CSS = `
  [data-boogy="list"] { display: flex; flex-direction: column; margin: 0; padding: 0; list-style: none; }
  [data-boogy="list-item"] {
    box-sizing: border-box;
    display: flex;
    align-items: center;
    gap: var(--space-2);
    width: 100%;
    padding: var(--space-2);
    border: none;
    border-radius: var(--radius-2);
    background: transparent;
    color: inherit;
    font: inherit;
    text-align: start;
    text-decoration: none;
  }
  :is(button, a)[data-boogy="list-item"] { cursor: pointer; }
  :is(button, a)[data-boogy="list-item"]:hover { background: var(--fill-hover); }
  [data-boogy="list-item"]:focus-visible { outline: var(--ring) solid var(--accent); outline-offset: 0; }
  [data-boogy="list-item"] > [data-slot="text"] { display: flex; flex-direction: column; flex: 1 1 auto; min-width: 0; }
  [data-boogy="list-item"] [data-slot="title"] {
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    font-weight: 500;
  }
  [data-boogy="list-item"] [data-slot="subtitle"] {
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    color: var(--text-2); font-size: var(--fs-caption);
  }
  [data-boogy="list-item"] [data-slot="description"] {
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    color: var(--text-3); font-size: var(--fs-caption);
  }
  [data-boogy="list-item"] > [data-slot="end"] { flex: none; position: relative; }
${titleControlCovers('[data-boogy="list-item"]')}
`;

// Notice: a quiet one-line explanation; the warning tone is for something the
// person should know went wrong.
const NOTICE_CSS = `
  [data-boogy="notice"] { margin: 0; color: var(--text-3); font-size: var(--fs-caption); }
  [data-boogy="notice"][data-tone="warning"] { color: var(--warn); }
`;

// Info list: labels in one column, values in the other; a long value ends in
// an ellipsis rather than widening the list.
const INFO_LIST_CSS = `
  [data-boogy="info-list"] {
    display: grid;
    grid-template-columns: max-content 1fr;
    gap: var(--space-1) var(--space-3);
    margin: 0;
    font-size: var(--fs-detail);
  }
  [data-boogy="info-list"] > dt { color: var(--text-3); }
  [data-boogy="info-list"] > dd { margin: 0; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  [data-boogy="info-list"] > dd > a { color: var(--accent); text-decoration: none; }
  [data-boogy="info-list"] > dd > a:hover { text-decoration: underline; }
`;

// Detail header: media beside the text; on a narrow container the two stack.
// Card: head (media, title, subtitle), a body (summary, caption lines), and a
// foot for actions that sits at the bottom so a row of cards lines up.
// CardGrid: columns no narrower than --card-min and never more than three —
// the floor is the larger of --card-min and a third of the width — so it is
// three, two or one column as its container allows. auto-FIT, so a row of
// fewer cards than columns stretches them across rather than leaving holes.
const CARD_CSS = `
  [data-boogy="card-grid"] {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(max(var(--card-min), (100% - 2 * var(--space-2)) / 3), 1fr));
    gap: var(--space-2);
    margin: 0;
    padding: 0;
    list-style: none;
  }
  [data-boogy="card-grid"] > li { display: flex; min-width: 0; }
  [data-boogy="card"] {
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    width: 100%;
    min-width: 0;
    padding: var(--space-3);
    border: 1px solid var(--edge);
    border-radius: var(--radius-3);
    background: var(--ground-raised);
    color: inherit;
  }
  [data-boogy="card"] > [data-slot="head"] { display: flex; align-items: center; gap: var(--space-2); min-width: 0; }
  [data-boogy="card"] > [data-slot="head"] > [data-slot="media"] { flex: none; display: flex; }
  [data-boogy="card"] > [data-slot="head"] > [data-slot="heading"] { display: flex; flex-direction: column; flex: 1 1 auto; min-width: 0; }
  [data-boogy="card"] [data-slot="title"] { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 600; }
  [data-boogy="card"] [data-slot="subtitle"] {
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    color: var(--text-2); font-size: var(--fs-caption);
  }
  [data-boogy="card"] > [data-slot="body"] { display: flex; flex-direction: column; gap: var(--space-1); min-width: 0; }
  [data-boogy="card"] [data-slot="summary"] {
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 3;
    overflow: hidden;
    overflow-wrap: anywhere;
    margin: 0;
    color: var(--text-2);
    font-size: var(--fs-detail);
  }
  [data-boogy="card"] [data-slot="meta"] {
    margin: 0;
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    color: var(--text-3); font-size: var(--fs-caption);
  }
  [data-boogy="card"] > [data-slot="foot"] {
    position: relative;
    display: flex;
    justify-content: flex-end;
    gap: var(--space-2);
    margin-top: auto;
  }
${titleControlCovers('[data-boogy="card"]')}
  /* FLUSH: the cards tile like panes. Each card draws a hairline border on its
     right and bottom, one hairline past its cell (the negative margin), and the
     grid clips the ones along its own edge — so only the lines BETWEEN cards
     show. A line runs above the first row and below the last; the sides are
     whatever the grid sits in. The card is sized by its cell (flex), not by
     width: 100%, which would swallow the negative margin. The card itself is
     transparent until hovered, and its focus ring is drawn inside it, where
     the clipping cannot reach. */
  [data-boogy="card-grid"][data-variant="flush"] {
    gap: 0;
    overflow: hidden;
    border-block: 1px solid var(--card-divider);
  }
  [data-boogy="card-grid"][data-variant="flush"] [data-boogy="card"] {
    border: none;
    border-right: 1px solid var(--card-divider);
    border-bottom: 1px solid var(--card-divider);
    margin: 0 -1px -1px 0;
    width: auto;
    flex: 1 1 auto;
    border-radius: 0;
    background: transparent;
  }
  [data-boogy="card-grid"][data-variant="flush"] [data-boogy="card"]:has([data-slot="title"] > :focus-visible) {
    outline-offset: calc(var(--ring) * -1);
  }
`;

// Stack: a column, or a row that wraps, its children a space token apart and
// bringing no margins of their own.
const STACK_CSS = `
  [data-boogy="stack"] { display: flex; flex-direction: column; min-width: 0; }
  [data-boogy="stack"][data-direction="row"] { flex-direction: row; flex-wrap: wrap; align-items: center; }
  [data-boogy="stack"] > * { margin: 0; }
  [data-boogy="stack"][data-gap="1"] { gap: var(--space-1); }
  [data-boogy="stack"][data-gap="2"] { gap: var(--space-2); }
  [data-boogy="stack"][data-gap="3"] { gap: var(--space-3); }
  [data-boogy="stack"][data-gap="4"] { gap: var(--space-4); }
`;

const DETAIL_HEADER_CSS = `
  [data-boogy="detail-header"] {
    container-type: inline-size;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-3);
  }
  [data-boogy="detail-header"] > [data-slot="text"] { display: flex; flex-direction: column; gap: var(--space-1); min-width: 0; }
  [data-boogy="detail-header"] [data-slot="title"] { margin: 0; font-size: var(--fs-title); font-weight: 600; overflow-wrap: anywhere; }
  [data-boogy="detail-header"] [data-slot="meta"] {
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    color: var(--text-2); font-size: var(--fs-detail);
  }
  [data-boogy="detail-header"] [data-slot="actions"] { display: flex; gap: var(--space-2); margin-top: var(--space-1); }
  /* A container query styles the container's DESCENDANTS, never the
     container itself — so a narrow header stacks by its text taking a whole
     row under the media, not by the header changing direction. */
  @container (width < 20rem) {
    [data-boogy="detail-header"] > [data-slot="text"] { flex-basis: 100%; }
  }
`;

export const COMPONENTS_CSS_PARTS = { PILL_CSS, BUTTON_CSS, DRAWER_CSS, POPOVER_CSS, MENU_CSS, SHEET_CSS, FIELD_CSS, SECTION_CSS, THUMBNAIL_CSS, TILE_CSS, LIST_CSS, NOTICE_CSS, INFO_LIST_CSS, DETAIL_HEADER_CSS, STACK_CSS, CARD_CSS };

export const COMPONENTS_CSS = `
@layer boogy.components {
${PILL_CSS}
${BUTTON_CSS}
${DRAWER_CSS}
${POPOVER_CSS}
${MENU_CSS}
${SHEET_CSS}
${FIELD_CSS}
${SECTION_CSS}
${THUMBNAIL_CSS}
${TILE_CSS}
${LIST_CSS}
${NOTICE_CSS}
${INFO_LIST_CSS}
${DETAIL_HEADER_CSS}
${STACK_CSS}
${CARD_CSS}
}
`;
