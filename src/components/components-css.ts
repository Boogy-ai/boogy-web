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
    outline: var(--ring) solid var(--ring-color);
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
  [data-boogy="button"][data-size="lg"] { --_h: var(--control-lg); padding: 0 var(--space-4); font-size: var(--fs-body); }
  [data-boogy="button"][data-shape="icon"] { width: var(--_h); padding: 0; }
  [data-boogy="button"][data-rounded="true"] { border-radius: var(--radius-full); }
  [data-boogy="button"]:focus-visible {
    outline: var(--ring) solid var(--ring-color);
    outline-offset: var(--ring);
  }
  [data-boogy="button"]:is(:disabled, [aria-disabled="true"]) { opacity: 0.45; cursor: default; }
  /* A finger does not shrink with the unit: on a touch screen every button is
     at least 44px. A device capability, not a layout breakpoint. */
  @media (pointer: coarse) {
    [data-boogy="button"] { min-height: var(--touch-min); }
    [data-boogy="button"][data-shape="icon"] { min-width: var(--touch-min); }
  }

  /* A glyph the SDK draws: sized from the icon tokens. */
  [data-boogy="glyph"] { flex: none; width: var(--icon-md); height: var(--icon-md); }
  [data-boogy="glyph"][data-size="sm"] { width: var(--icon-sm); height: var(--icon-sm); }

  /* Zoom controls: two buttons a hair apart; each shows a letter, small for
     smaller and large for larger, from the text tokens. */
  [data-boogy="zoom-controls"] { display: inline-flex; align-items: center; gap: var(--space-0); }
  [data-boogy="zoom-controls"] [data-slot="letter"] { font-family: var(--font-body); font-weight: 600; line-height: 1; }
  [data-boogy="zoom-controls"] [data-slot="smaller"] > [data-slot="letter"] { font-size: var(--fs-caption); }
  [data-boogy="zoom-controls"] [data-slot="larger"] > [data-slot="letter"] { font-size: var(--fs-title); }

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
  [data-boogy="button"][data-fill="true"] { flex: 1 1 auto; width: 100%; }
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
      /* The drawer's edge is --drawer-edge whether or not it is resizable:
         the resize handle draws it while docked and expanded, this border
         every other docked moment (collapsed to the strip, or not resizable).
         With the defaults it is exactly --rule (1px solid --edge); an app that
         sets --drawer-edge gets ONE edge colour in both states, not two. */
      border-inline-end: 1px var(--drawer-edge-style, solid) var(--drawer-edge);
      transition: width var(--dur-base) ease-out;
    }
    [data-collapse-at="${at}"][data-side="end"] > [data-boogy="drawer"] {
      border-inline-end: none;
      border-inline-start: 1px var(--drawer-edge-style, solid) var(--drawer-edge);
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
    --drawer-mark-ground: var(--ground-solid);
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
    outline: var(--ring) solid var(--ring-color);
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
  /* The default mark's initials are capitals with nothing below the baseline,
     so centring their LINE box leaves the letters high (the line reserves room
     for descenders). Trimmed to cap height, the box the mark centres is the
     letters themselves. */
  [data-boogy="drawer-item"] > [data-slot="mark"] > [data-slot="initials"] { text-box: trim-both cap alphabetic; }
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
     on focus and while dragged. Shown only docked and expanded (above). Drawn
     as a border, not a fill, so --drawer-edge-style (solid by default, or
     dotted / dashed) shapes it like the drawer's own edge. */
  [data-boogy="drawer-resizer"] {
    display: none;
    position: relative;
    z-index: 1;
    flex: none;
    order: 1;
    width: 0;
    border-inline-start: 1px var(--drawer-edge-style, solid) var(--drawer-edge);
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
    border-inline-start-color: var(--drawer-edge-hover);
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
    background: var(--popover-ground, var(--ground-solid));
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
  [data-boogy="popover"] > [data-slot="head"] > [data-slot="title-icon"] { display: flex; flex: none; color: var(--text-2); }
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
  /* A menu's row, a plain item or a row of controls (a top bar's widget):
     one size, padding and ink. */
  [data-boogy="menu-row"], [data-boogy="menu-item"] {
    min-height: var(--control-md);
    padding: var(--space-1) var(--space-2);
    border-radius: var(--radius-1);
    color: var(--text-1);
    font-size: var(--fs-detail);
  }
  [data-boogy="menu-item"] {
    display: grid;
    grid-template-columns: 1fr auto auto;
    grid-template-areas: "label kbd indicator" "description kbd indicator";
    align-items: center;
    column-gap: var(--space-3);
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
  /* A leading icon or swatch: a column of its own, only on an item that has
     one, so a menu without icons keeps its labels against the edge. */
  [data-boogy="menu-item"]:has(> [data-slot="icon"]) {
    grid-template-columns: auto 1fr auto auto;
    grid-template-areas: "icon label kbd indicator" "icon description kbd indicator";
  }
  [data-boogy="menu-item"] > [data-slot="icon"] { grid-area: icon; display: flex; color: var(--text-2); }
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
    /* Over the page it covers: nothing in it paints through, not even what
       the components stack within it (a table's sticky header, a card's
       covering title, at 1). Under a drawer's overlay and its backdrop (20,
       19), which open over whatever page is showing. */
    z-index: 10;
    overflow: hidden;
    /* The page's own ground, translucent, so whatever frames the page shows
       through it as it does through the page. A page that wants it opaque
       sets --sheet-ground (to --ground-solid, say). */
    background: var(--sheet-ground, var(--ground));
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
  /* The title may carry media beside its text (an avatar by a name). */
  [data-boogy="sheet"] > [data-slot="head"] > [data-slot="title"] {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    min-width: 0;
    margin: 0;
    font: inherit;
  }
  /* The head's end: a bar of controls, pushed to the far edge. Body-sized, so
     its controls are the controls' own size, not the title's. */
  [data-boogy="sheet"] > [data-slot="head"] > [data-slot="end"] {
    display: flex;
    align-items: center;
    gap: var(--space-1);
    margin-inline-start: auto;
    font-size: var(--fs-body);
    font-weight: 400;
  }
  /* A head of the caller's own: the head's frame (its edge and padding), and
     none of the title's type. What it holds takes the head's width. */
  [data-boogy="sheet"] > [data-slot="head"][data-head="own"] { font-size: var(--fs-body); font-weight: 400; }
  [data-boogy="sheet"] > [data-slot="head"][data-head="own"] > * { flex: 1 1 auto; min-width: 0; }
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
  /* A field in the foot (a composer) takes the foot's width — and IS the bar:
     the foot becomes a darker translucent well, the field's own frame dissolves
     into it, and with no frame left the foot's top edge shows focus. */
  [data-boogy="sheet"] > [data-slot="foot"] > [data-boogy="field"] { flex: 1 1 auto; min-width: 0; }
  [data-boogy="sheet"] > [data-slot="foot"]:has(> [data-boogy="field"]) { background: var(--ground-well); }
  [data-boogy="sheet"] > [data-slot="foot"]:has(> [data-boogy="field"]):focus-within { border-top-color: var(--accent); }
  [data-boogy="sheet"] > [data-slot="foot"] > [data-boogy="field"] > [data-slot="group"] {
    border: none;
    background: transparent;
    border-radius: 0;
    box-shadow: none;
  }
  [data-boogy="sheet"] > [data-slot="foot"] > [data-boogy="field"] > [data-slot="group"]:focus-within { outline: none; }
`;

// --- EmptyState (see empty-state.ts) ---
// Centred on both axes in whatever space it is given; the graphic in a large
// accent disc, sized by the disc's font-size (an icon drawn at 1em fills it).
const EMPTY_STATE_CSS = `
  [data-boogy="empty-state"] {
    flex: 1 1 auto;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: var(--space-2);
    padding: var(--space-6) var(--space-4);
    text-align: center;
  }
  [data-boogy="empty-state"] > [data-slot="media"] {
    display: grid;
    place-items: center;
    width: var(--thumb-lg);
    height: var(--thumb-lg);
    margin-bottom: var(--space-2);
    border-radius: var(--radius-full);
    background: var(--accent-soft);
    color: var(--accent);
    font-size: var(--fs-display);
  }
  [data-boogy="empty-state"] > [data-slot="title"] {
    margin: 0;
    color: var(--text-1);
    font-size: var(--fs-title);
    font-weight: 600;
  }
  [data-boogy="empty-state"] > [data-slot="description"] {
    margin: 0;
    max-width: 32ch;
    color: var(--text-2);
  }
  [data-boogy="empty-state"] > [data-slot="action"] { margin-top: var(--space-3); }
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
    outline: var(--ring) solid var(--ring-color);
    outline-offset: 1px;
  }
  [data-boogy="field"] > [data-slot="control"]:disabled { opacity: 0.45; }
  /* A multi-line control on its own (TextArea): it grows with its text, and
     shows at least its rows (--field-rows) whatever the text, where a
     content-sized field would shrink to one line. */
  [data-boogy="field"] > textarea[data-slot="control"] {
    padding-block: var(--space-2);
    resize: vertical;
    field-sizing: content;
    min-block-size: calc(var(--field-rows, 2) * 1lh + 2 * var(--space-2));
  }
  /* LG on its own control: at title size, its label at body size; a one-line
     input is taller too (a multi-line one keeps its rows, above). */
  [data-boogy="field"][data-size="lg"] > [data-slot="control"] { font-size: var(--fs-title); }
  [data-boogy="field"][data-size="lg"] > input[data-slot="control"] { min-height: var(--control-lg); }
  [data-boogy="field"][data-size="lg"] > [data-slot="label"] { font-size: var(--fs-body); }
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
    outline: var(--ring) solid var(--ring-color);
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
  /* LG: the field that is the main thing on its surface — taller, with larger
     medium-weight text and more room around its icon. */
  [data-boogy="field"][data-size="lg"] > [data-slot="group"],
  [data-boogy="field"][data-size="lg"] > [data-slot="group"] > [data-slot="control"] { min-height: var(--control-lg); }
  [data-boogy="field"][data-size="lg"] > [data-slot="group"] { font-size: var(--fs-title); font-weight: 500; }
  [data-boogy="field"][data-size="lg"] > [data-slot="group"] > [data-slot="icon"] { padding-inline: var(--space-3) var(--space-2); }
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
  /* A multi-line field: a textarea in the group grows with its text, up to
     eight lines, and what sits beside it (a send button) stays at its bottom. */
  [data-boogy="field"] > [data-slot="group"]:has(> textarea) { align-items: flex-end; }
  /* Beside it, a suffix is one line of the field tall (the group is
     content-box: inside its border it is exactly the control height), its
     content centred: centred on one line, at the bottom as the text grows. */
  [data-boogy="field"] > [data-slot="group"]:has(> textarea) > [data-slot="suffix"] {
    align-items: center;
    block-size: var(--control-md);
  }
  [data-boogy="field"] > [data-slot="group"] > textarea[data-slot="control"] {
    align-self: stretch;
    padding-block: var(--space-1);
    resize: none;
    field-sizing: content;
    max-height: 8lh;
  }
  /* Nothing before the control (no icon or prefix): it pads its own start. */
  [data-boogy="field"] > [data-slot="group"] > [data-slot="control"]:first-child { padding-inline-start: var(--space-2); }
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
  [data-boogy="section"] { display: flex; flex-direction: column; gap: var(--space-3); }
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
    color: var(--text-2);
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

// Avatar: a person, as a circle or a rounded square, at the thumbnail's sizes
// so the two line up. A picture covers it; without one the initials sit in
// white over seeded art (always dark enough for white to read).
const AVATAR_CSS = `
  [data-boogy="avatar"] {
    position: relative;
    flex: none;
    display: inline-grid;
    place-items: center;
    overflow: hidden;
    background: var(--fill-hover);
    color: oklch(0.98 0 0);
    font-weight: 600;
    line-height: 1;
    user-select: none;
    /* Its own container, so the initials can be a share of its size. */
    container-type: size;
  }
  [data-boogy="avatar"][data-variant="circle"] { border-radius: var(--radius-full); }
  [data-boogy="avatar"][data-variant="rounded"] { border-radius: var(--radius-2); }
  [data-boogy="avatar"][data-variant="rounded"][data-size="lg"] { border-radius: var(--radius-3); }
  [data-boogy="avatar"][data-size="sm"] { width: var(--thumb-sm); height: var(--thumb-sm); }
  [data-boogy="avatar"][data-size="md"] { width: var(--thumb-md); height: var(--thumb-md); }
  [data-boogy="avatar"][data-size="lg"] { width: var(--thumb-lg); height: var(--thumb-lg); }
  [data-boogy="avatar"] > img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
  /* The initials: 42% of the avatar's diameter at every size. */
  [data-boogy="avatar"] > [data-slot="initials"] { position: relative; font-size: 42cqmin; }
`;

// Thread and Bubble (see bubble.ts): a column of messages, each on its side.
// The other person's on a faint fill with a faint edge, yours on the soft
// accent — both in the ink, so either reads on any ground behind.
const BUBBLE_CSS = `
  [data-boogy="thread"] {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }
  [data-boogy="bubble"] {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    align-self: flex-start;
    gap: var(--space-0);
    max-width: 80%;
  }
  [data-boogy="bubble"][data-side="end"] { align-self: flex-end; align-items: flex-end; }
  [data-boogy="bubble"] > [data-slot="body"] {
    padding: var(--space-2) var(--space-3);
    border: 1px solid var(--edge);
    border-radius: var(--radius-3);
    background: var(--fill-hover);
    color: var(--text-1);
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }
  [data-boogy="bubble"][data-side="end"] > [data-slot="body"] { border-color: transparent; background: var(--accent-soft); }
  [data-boogy="bubble"] > [data-slot="meta"] {
    display: inline-flex;
    align-items: center;
    gap: var(--space-1);
    padding-inline: var(--space-1);
    color: var(--text-3);
    font-size: var(--fs-caption);
  }
  /* Delivery: one check sent, two delivered, two in the accent seen. */
  [data-boogy="delivery-mark"] { display: inline-flex; color: var(--text-3); }
  [data-boogy="delivery-mark"][data-status="seen"] { color: var(--accent); }
  /* Typing: three dots on the other person's side, pulsing in turn. */
  [data-boogy="bubble"][data-typing="true"] > [data-slot="body"] {
    display: inline-flex;
    align-items: center;
    gap: var(--space-1);
  }
  [data-boogy="bubble"][data-typing="true"] [data-slot="dot"] {
    width: var(--space-2);
    height: var(--space-2);
    border-radius: var(--radius-full);
    background: var(--text-3);
    animation: boogy-typing 1.2s infinite ease-in-out;
  }
  [data-boogy="bubble"][data-typing="true"] [data-slot="dot"]:nth-child(2) { animation-delay: 0.15s; }
  [data-boogy="bubble"][data-typing="true"] [data-slot="dot"]:nth-child(3) { animation-delay: 0.3s; }
  @keyframes boogy-typing { 0%, 60%, 100% { opacity: 0.3; } 30% { opacity: 1; } }
  @media (prefers-reduced-motion: reduce) {
    [data-boogy="bubble"][data-typing="true"] [data-slot="dot"] { animation: none; }
  }
`;

// SeededArt: fills its nearest positioned ancestor, cropped to cover it.
const SEEDED_ART_CSS = `
  [data-boogy="seeded-art"] { position: absolute; inset: 0; width: 100%; height: 100%; display: block; }
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
  [data-boogy="tile"]:focus-visible { outline: var(--ring) solid var(--ring-color); outline-offset: 0; }
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
  ${host}:has([data-slot="title"] > :focus-visible) { outline: var(--ring) solid var(--ring-color); outline-offset: 0; }
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
  [data-boogy="list-item"]:focus-visible { outline: var(--ring) solid var(--ring-color); outline-offset: 0; }
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
  /* With meta: the title and, at the end of its line, the meta. */
  [data-boogy="list-item"] [data-slot="heading"] { display: flex; align-items: baseline; gap: var(--space-2); min-width: 0; }
  /* The title keeps its width while the meta has any to give (capped at the
     row, so a long name still ellipsizes on its own). */
  [data-boogy="list-item"] [data-slot="heading"] > [data-slot="title"] { flex: 1 0 auto; max-width: 100%; min-width: 0; }
  /* Squeezed, the meta gives up its width first and ellipsizes: the title is
     the row, the meta a detail. */
  [data-boogy="list-item"] [data-slot="meta"] {
    flex: 0 999 auto;
    min-width: 0;
    margin-inline-start: auto;
    color: var(--text-3);
    font-size: var(--fs-caption);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  [data-boogy="list-item"] > [data-slot="end"] { flex: none; position: relative; }
${titleControlCovers('[data-boogy="list-item"]')}
`;

// Notice: a quiet one-line explanation; the warning tone is for something the
// person should know went wrong. Its words meet 4.5:1 on every ground in both
// schemes, so the neutral tone is the secondary text colour: the muted caption
// colour falls under that on a sunken ground.
const NOTICE_CSS = `
  [data-boogy="notice"] { margin: 0; color: var(--text-2); font-size: var(--fs-caption); }
  /* The warning hue is not dark enough to be words on every ground, so its words
     take the primary text colour and the hue stands in an edge beside them. */
  [data-boogy="notice"][data-tone="warning"] {
    color: var(--text-1);
    padding-inline-start: var(--space-2);
    border-inline-start: var(--space-1) solid var(--warn);
  }
  [data-boogy="notice"][data-tone="danger"] { color: var(--danger); }
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
  /* COVER: full-bleed media across the top of the card, above the head — the
     card's padding is taken back with a negative margin, and its corners follow
     the card's. */
  [data-boogy="card"] > [data-slot="cover"] {
    display: block;
    margin: calc(var(--space-3) * -1) calc(var(--space-3) * -1) 0;
    border-bottom: 1px solid var(--edge);
    border-radius: calc(var(--radius-3) - 1px) calc(var(--radius-3) - 1px) 0 0;
    overflow: hidden;
  }
  /* SPACED-SQUARE: the spaced grid's gaps, with square corners. */
  [data-boogy="card-grid"][data-variant="spaced-square"] [data-boogy="card"] { border-radius: 0; }
  [data-boogy="card-grid"]:is([data-variant="flush"], [data-variant="spaced-square"]) [data-boogy="card"] > [data-slot="cover"] { border-radius: 0; }
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

// Carousel: images filling a fixed frame (--cover-aspect, 16:10 by default),
// never taller than --cover-max-height (12 units by default): a card stretched
// across a wide row gets a wider crop of its image, not a taller cover.
// The pager — previous/next and a dot per image — sits OVER an arbitrary image,
// so it wears a fixed dark translucent ground whatever the theme. Its controls
// sit above a card's covering title control (z-index), like the card's foot.
const CAROUSEL_CSS = `
  [data-boogy="carousel"] {
    --_cover-max: calc(var(--u) * 12);
    position: relative;
    display: block;
    aspect-ratio: var(--cover-aspect, 16 / 10);
    max-height: var(--cover-max-height, var(--_cover-max));
    width: 100%;
    overflow: hidden;
    background: var(--ground-sunken);
  }
  [data-boogy="carousel"] > img { display: block; width: 100%; height: 100%; object-fit: cover; }
  /* EMPTY: no image to show — the caller's fallback fills the same frame, so
     a row mixing covers with and without images lines up. */
  [data-boogy="carousel"] > [data-slot="fallback"] { position: absolute; inset: 0; display: flex; }
  [data-boogy="carousel"] > [data-slot="fallback"] > * { flex: 1 1 auto; min-width: 0; }
  [data-boogy="carousel"] > :is([data-slot="prev"], [data-slot="next"]) {
    position: absolute;
    top: 50%;
    z-index: 1;
    transform: translateY(-50%);
    display: flex;
    align-items: center;
    justify-content: center;
    width: var(--touch-min);
    height: var(--touch-min);
    padding: 0;
    border: none;
    background: transparent;
    color: oklch(0.98 0 0);
    cursor: pointer;
  }
  [data-boogy="carousel"] > [data-slot="prev"] { left: 0; }
  [data-boogy="carousel"] > [data-slot="next"] { right: 0; }
  [data-boogy="carousel"] > :is([data-slot="prev"], [data-slot="next"]) > span {
    display: flex;
    align-items: center;
    justify-content: center;
    width: var(--control-sm);
    height: var(--control-sm);
    border-radius: var(--radius-full);
    background: oklch(0.12 0 0 / 0.62);
    transition: background var(--dur-fast);
  }
  [data-boogy="carousel"] > :is([data-slot="prev"], [data-slot="next"]):hover > span { background: oklch(0.12 0 0 / 0.8); }
  [data-boogy="carousel"] > :is([data-slot="prev"], [data-slot="next"]):focus-visible { outline: none; }
  [data-boogy="carousel"] > :is([data-slot="prev"], [data-slot="next"]):focus-visible > span { outline: var(--ring) solid var(--ring-color); }
  [data-boogy="carousel"] > :is([data-slot="prev"], [data-slot="next"]) svg { width: var(--icon-sm); height: var(--icon-sm); }
  [data-boogy="carousel"] > [data-slot="dots"] {
    position: absolute;
    left: 50%;
    bottom: var(--space-1);
    z-index: 1;
    transform: translateX(-50%);
    display: flex;
    padding: 0 var(--space-1);
    border-radius: var(--radius-full);
    background: oklch(0.12 0 0 / 0.62);
  }
  [data-boogy="carousel"] > [data-slot="dots"] > button {
    --_dot: calc(var(--u) * 0.375);
    --_dot-on: calc(var(--u) * 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    width: var(--icon-md);
    height: var(--icon-md);
    padding: 0;
    border: none;
    background: transparent;
    cursor: pointer;
  }
  [data-boogy="carousel"] > [data-slot="dots"] > button::before {
    content: "";
    width: var(--_dot);
    height: var(--_dot);
    border-radius: var(--radius-full);
    background: oklch(0.98 0 0 / 0.5);
  }
  [data-boogy="carousel"] > [data-slot="dots"] > button[aria-current="true"]::before {
    width: var(--_dot-on);
    height: var(--_dot-on);
    background: oklch(0.98 0 0);
  }
  [data-boogy="carousel"] > [data-slot="dots"] > button:focus-visible { outline: var(--ring) solid var(--ring-color); border-radius: var(--radius-full); }
`;


// --- InlineEdit (see inline-edit.ts) ---
// Text at rest — no edge, no ground, the surrounding type — so a name reads as a
// name; a field when pointed at (its edge) and when editing (edge and ground).
// `field-sizing: content` makes it as wide as its text, so it hugs a short name
// and gives way (to `max-width`) for a long one.
const INLINE_EDIT_CSS = `
  [data-boogy="inline-edit"] {
    box-sizing: border-box;
    min-width: var(--control-md);
    max-width: 100%;
    min-height: var(--control-sm);
    padding: 0 var(--space-1);
    border: 1px solid transparent;
    border-radius: var(--radius-1);
    background: transparent;
    color: inherit;
    font: inherit;
    field-sizing: content;
    text-overflow: ellipsis;
    transition: border-color var(--dur-fast) ease-out;
  }
  [data-boogy="inline-edit"]:hover { border-color: var(--edge); }
  [data-boogy="inline-edit"]:focus {
    border-color: var(--edge-strong);
    background: var(--ground-sunken);
    outline: none;
  }
  [data-boogy="inline-edit"]:focus-visible {
    outline: var(--ring) solid var(--ring-color);
    outline-offset: 1px;
  }
`;

// --- Swatch (see swatch.ts) ---
// A round chip at icon size, filled from --swatch-color. The hairline border,
// inside the chip's size, is what keeps a colour close to its surroundings (a
// black chip on a near-black menu) visible as a chip.
const SWATCH_CSS = `
  [data-boogy="swatch"] {
    display: inline-block;
    flex: none;
    box-sizing: border-box;
    width: var(--icon-sm);
    height: var(--icon-sm);
    border: 1px solid var(--edge-strong);
    border-radius: 50%;
    background: var(--swatch-color, transparent);
  }
`;

// --- Tabs (see tabs.ts) ---
// A row of tabs on a line: a thin, dim shade of the accent under every tab, and
// the selected tab in the full ink with the full accent, thicker, under it —
// drawn as its own bottom border laid over the row's line (the -1px margin), so
// the two read as one line that brightens under the selected tab.
const TABS_CSS = `
  [data-boogy="tabs"] > [data-slot="list"] {
    display: flex;
    gap: 0;
    border-bottom: 1px solid color-mix(in oklch, var(--accent) 35%, transparent);
  }
  [data-boogy="tabs"] [data-slot="tab"] {
    position: relative;
    margin-bottom: -1px;
    padding: var(--space-2);
    border: none;
    border-bottom: var(--underline) solid transparent;
    background: transparent;
    color: var(--text-2);
    font: inherit;
    cursor: pointer;
  }
  [data-boogy="tabs"] [data-slot="tab"]:hover { color: var(--text-1); }
  /* A faint divider between neighbouring tabs, short of the row's top and
     bottom. The tabs sit edge to edge (no gap), so it is exactly between two;
     each tab's padding spaces the labels. */
  [data-boogy="tabs"] [data-slot="tab"] + [data-slot="tab"]::before {
    content: "";
    position: absolute;
    inset-block: var(--space-2);
    inset-inline-start: 0;
    border-inline-start: 1px solid var(--edge);
  }
  /* fill: every tab an equal share of the row, its label centred in it */
  [data-boogy="tabs"][data-fill="true"] [data-slot="tab"] { flex: 1 1 0; }
  [data-boogy="tabs"] [data-slot="tab"][aria-selected="true"] {
    color: var(--text-1);
    border-bottom-color: var(--accent);
  }
  [data-boogy="tabs"] [data-slot="tab"]:focus-visible {
    outline: var(--ring) solid var(--ring-color);
    outline-offset: -1px;
  }
  [data-boogy="tabs"] > [data-slot="panel"] { outline: none; }
`;

// --- FitText (see fit-text.ts) ---
// The size runs from --fit-min to --fit-max by the fitted factor; before the
// first fit, the factor is 1. Words are whole while it is fitted, so a word
// wider than the box reads as not fitting and the text shrinks; only text that
// overflows even at its minimum (data-overflow) breaks a word, rather than
// spilling sideways. The element is a block whatever its tag:
// an inline box has no size to fit within, so its text would always "fit".
const FIT_TEXT_CSS = `
  [data-boogy="fit-text"] {
    display: block;
    font-size: calc(var(--fit-min) + (var(--fit-max) - var(--fit-min)) * var(--fit, 1));
    overflow-wrap: normal;
  }
  [data-boogy="fit-text"][data-overflow="true"] { overflow-wrap: anywhere; }
`;

// --- FillGrid (see fill-grid.ts) ---
// Wrapping rows, centred, so a short last row sits in the middle. Each cell is
// a --cols-th of the width and a --rows-th of the height, less the gaps.
// Fallback: one scrolling column of full-width cells at the minimum height.
//
// The gap is REGISTERED, so it is resolved once, on the grid, and its cells
// inherit that length. Cells are sized to fill a row exactly, so the gap they
// subtract and the gap the grid lays out with must be one length: unregistered,
// a gap in container units is resolved again on each cell, and an engine that
// re-resolves the cells but not the grid (Firefox, when a zoom moves the
// container's padding but not its size) leaves cells a fraction of a pixel too
// wide, and the last one in each row wraps.
const FILL_GRID_PROPERTIES = `
@property --_fill-gap { syntax: '<length-percentage>'; inherits: true; initial-value: 0px; }
`;
const FILL_GRID_CSS = `
  [data-boogy="fill-grid"] {
    --_fill-gap: var(--fill-gap, var(--space-2));
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    align-content: center;
    gap: var(--_fill-gap);
    min-block-size: 0;
  }
  /* Its cells, never a popover rendered among them: the top layer takes a
     popover out of the grid's layout, but a rule for the grid's children
     would still match it and size it from the viewport. :where() keeps the
     rule's weight at one attribute, so a cell's own rules still win. */
  [data-boogy="fill-grid"] > :where(:not([popover])) {
    box-sizing: border-box;
    flex: 0 0 calc((100% - (var(--cols, 1) - 1) * var(--_fill-gap)) / var(--cols, 1));
    block-size: calc((100% - (var(--rows, 1) - 1) * var(--_fill-gap)) / var(--rows, 1));
    min-inline-size: 0;
  }
  [data-boogy="fill-grid"][data-fallback="true"] {
    flex-direction: column;
    flex-wrap: nowrap;
    justify-content: flex-start;
    overflow-y: auto;
  }
  [data-boogy="fill-grid"][data-fallback="true"] > :where(:not([popover])) {
    flex: none;
    inline-size: 100%;
    block-size: var(--fill-min-block);
  }
`;

// --- Segments (see segments.ts): one definition for Meter and ColumnChart ---
// A segment is its token colour. Stripes are that colour and a paler mix of it
// at 45°, so two segments of one hue read apart without colour vision. They are
// one tiled square of a plain gradient, not a repeating gradient: an engine can
// draw a repeating gradient with oklch() stops as a few stray lines on a flat
// ground.
const SEGMENT_CSS = `
  [data-slot="segment"] {
    display: block;
    flex: none;
    background: var(--segment-color);
  }
  [data-slot="segment"][data-pattern="stripes"] {
    background-color: color-mix(in oklch, var(--segment-color) 40%, transparent);
    background-image: linear-gradient(45deg,
      var(--segment-color) 25%, transparent 25% 50%,
      var(--segment-color) 50% 75%, transparent 75%);
    background-size: var(--space-3) var(--space-3);
  }
`;

// --- Meter (see meter.ts) ---
const METER_CSS = `
  [data-boogy="meter"] {
    display: flex;
    inline-size: 100%;
    block-size: var(--space-3);
    border-radius: var(--radius-full);
    background: var(--fill-hover);
    overflow: hidden;
  }
  [data-boogy="meter"] > [data-slot="segment"] { block-size: 100%; }
`;

// --- Switch (see switch.ts) ---
const SWITCH_CSS = `
  [data-boogy="switch"] {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    min-block-size: var(--touch-min);
    padding: 0;
    border: none;
    background: transparent;
    color: inherit;
    font: inherit;
    cursor: pointer;
  }
  [data-boogy="switch"]:disabled { opacity: 0.45; cursor: default; }
  [data-boogy="switch"] [data-slot="track"] {
    position: relative;
    flex: none;
    inline-size: var(--control-lg);
    block-size: var(--control-sm);
    border-radius: var(--radius-full);
    background: var(--fill-selected);
    transition: background-color var(--dur-fast) ease-out;
  }
  [data-boogy="switch"] [data-slot="thumb"] {
    position: absolute;
    inset-block-start: var(--space-0);
    inset-inline-start: var(--space-0);
    inline-size: calc(var(--control-sm) - 2 * var(--space-0));
    block-size: calc(var(--control-sm) - 2 * var(--space-0));
    border-radius: 50%;
    background: var(--ground-solid);
    transition-property: translate;
    transition-duration: var(--dur-fast);
    transition-timing-function: ease-out;
  }
  [data-boogy="switch"][aria-checked="true"] [data-slot="track"] { background: var(--accent); }
  [data-boogy="switch"][aria-checked="true"] [data-slot="thumb"] {
    translate: calc(var(--control-lg) - var(--control-sm)) 0;
  }
  [data-boogy="switch"]:focus-visible [data-slot="track"] {
    outline: var(--ring) solid var(--ring-color);
    outline-offset: var(--ring);
  }
  @media (prefers-reduced-motion: reduce) {
    [data-boogy="switch"] [data-slot="track"],
    [data-boogy="switch"] [data-slot="thumb"] { transition: none; }
  }
`;

// --- ChoiceGroup (see choice-group.ts) ---
const CHOICE_GROUP_CSS = `
  [data-boogy="choice-group"] {
    display: grid;
    gap: var(--space-2);
    margin: 0;
    padding: 0;
    border: none;
  }
  [data-boogy="choice-group"] > legend { padding: 0; margin-block-end: var(--space-2); }
  [data-boogy="choice-group"] [data-slot="choice"] {
    display: grid;
    grid-template-columns: auto 1fr;
    column-gap: var(--space-2);
    align-items: start;
  }
  [data-boogy="choice-group"] [data-slot="choice"] > input,
  [data-boogy="choice-group"] [data-slot="choice-label"],
  [data-boogy="choice-group"] [data-slot="choice-description"] { cursor: pointer; }
  [data-boogy="choice-group"]:disabled { opacity: 0.45; }
  [data-boogy="choice-group"]:disabled [data-slot="choice"] > input,
  [data-boogy="choice-group"]:disabled [data-slot="choice-label"],
  [data-boogy="choice-group"]:disabled [data-slot="choice-description"] { cursor: default; }
  [data-boogy="choice-group"] [data-slot="choice"] > input {
    grid-row: span 2;
    margin: var(--space-0) 0 0;
    accent-color: var(--accent);
    inline-size: var(--icon-sm);
    block-size: var(--icon-sm);
  }
  [data-boogy="choice-group"] [data-slot="choice-label"] { grid-column: 2; }
  [data-boogy="choice-group"] [data-slot="choice-description"] { grid-column: 2; color: var(--text-3); font-size: var(--fs-caption); }
`;

// --- Visually hidden: present for assistive technology, never drawn ---
// A table ignores the 1px box and is laid out at full size, so whatever holds
// a hidden table clips it (ColumnChart's figure does), or the table's unseen
// rows lengthen the scroll of the surface around it.
const VISUALLY_HIDDEN_CSS = `
  [data-visually-hidden] {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }
`;

// --- DataTable (see data-table.ts) ---
// The header row stays opaque over the rows scrolling beneath it
// (--table-head-ground, solid by default). The title cell takes the width the
// other columns leave and ends in an ellipsis. The sortable header shows its
// direction with an arrow, pointing down while descending; it keeps its place
// while unsorted, so the label never moves when the sort is set. A focused
// row's ring is drawn inside it: a row spans the scrolling box, which would
// clip a ring drawn outside.
const DATA_TABLE_CSS = `
  [data-boogy="data-table"] { overflow: auto; min-block-size: 0; }
  [data-boogy="data-table"] > table {
    inline-size: 100%;
    border-collapse: collapse;
    font-size: var(--fs-detail);
    table-layout: auto;
  }
  [data-boogy="data-table"] thead th {
    position: sticky;
    inset-block-start: 0;
    z-index: 1;
    background: var(--table-head-ground, var(--ground-solid));
    color: var(--text-2);
    font-weight: 500;
    text-align: start;
    white-space: nowrap;
    border-block-end: 1px solid var(--edge);
  }
  [data-boogy="data-table"] :is(th, td) {
    block-size: var(--control-md);
    padding: 0 var(--space-2);
    white-space: nowrap;
  }
  [data-boogy="data-table"] tbody tr + tr { border-block-start: 1px solid var(--edge); }
  [data-boogy="data-table"] tbody th { font-weight: inherit; text-align: start; max-inline-size: 0; inline-size: 100%; }
  [data-boogy="data-table"] [data-numeric="true"] { text-align: end; font-variant-numeric: tabular-nums; }
  [data-boogy="data-table"] thead button {
    all: unset;
    display: inline-flex;
    align-items: center;
    gap: var(--space-1);
    cursor: pointer;
  }
  [data-boogy="data-table"] thead button:hover { color: var(--text-1); }
  [data-boogy="data-table"] thead button:focus-visible { outline: var(--ring) solid var(--ring-color); }
  [data-boogy="data-table"] [aria-sort="ascending"] [data-slot="sort"] { scale: 1 -1; }
  [data-boogy="data-table"] [aria-sort="none"] [data-slot="sort"] { visibility: hidden; }
${titleControlCovers('[data-boogy="data-table"] tbody tr')}
  [data-boogy="data-table"] tbody tr:has([data-slot="title"] > :focus-visible) { outline-offset: calc(var(--ring) * -1); }
`;

// --- Stat (see stat.ts) ---
// The value is set in tabular figures of the body face, so a value that
// updates live keeps its width as its digits change. It stays on one line:
// with no height to bound it, a wrapped value would always fit, and never
// shrink to its width. Its line is the font's own height (`normal`): a tighter
// one lets the glyphs spill past the line box, which the fit reads as
// overflow, so the value would shrink however much room it had. As a grid
// item on one line it would widen to that line, so its minimum width is 0:
// the stat's width is the one it fits. Its rows
// pack to the top, so a stat with no caption, stretched beside one that has
// one, keeps its label under its value.
const STAT_CSS = `
  [data-boogy="stat"] { display: grid; align-content: start; gap: var(--space-1); min-inline-size: 0; }
  [data-boogy="stat"] > [data-slot="value"] { margin: 0; min-inline-size: 0; line-height: normal; white-space: nowrap; font-weight: 600; font-variant-numeric: tabular-nums; }
  [data-boogy="stat"] > [data-slot="label"] { margin: 0; color: var(--text-2); }
  [data-boogy="stat"] > [data-slot="caption"] { margin: 0; color: var(--text-3); font-size: var(--fs-caption); }
`;

// --- ColumnChart (see column-chart.ts) ---
// Columns grow from one baseline and are capped in width, so a short series
// spreads across the axis rather than filling it with slabs. The segments of
// a column stand --chart-segment-gap apart, and the top one rounds its data
// end; the baseline end stays square. That one property both draws the gaps
// and is taken off the height the segments are scaled into, so the two never
// disagree. The figure clips, so the hidden table of values never adds scroll
// to the surface around it; `hidden` is declared first, for an engine without
// `clip`.
const COLUMN_CHART_CSS = `
  [data-boogy="column-chart"] {
    --chart-segment-gap: var(--space-0);
    display: grid; gap: var(--space-1); margin: 0; position: relative; overflow: hidden; overflow: clip;
  }
  [data-boogy="column-chart"] [data-slot="columns"] {
    display: flex;
    align-items: stretch;
    justify-content: space-between;
    gap: var(--space-0);
    block-size: var(--chart-height, var(--space-8));
    border-block-end: 1px solid var(--edge-strong);
  }
  [data-boogy="column-chart"] [data-slot="column"] {
    display: flex;
    flex: 1 1 0;
    flex-direction: column-reverse;
    gap: var(--chart-segment-gap);
    min-inline-size: 0;
    max-inline-size: var(--space-5);
  }
  [data-boogy="column-chart"] [data-slot="column"] > [data-slot="segment"] { flex: 0 1 auto; }
  [data-boogy="column-chart"] [data-slot="column"] > [data-slot="segment"]:last-child {
    border-start-start-radius: var(--radius-1);
    border-start-end-radius: var(--radius-1);
  }
  [data-boogy="column-chart"] [data-slot="axis"] {
    display: flex;
    justify-content: space-between;
    color: var(--text-3);
    font-size: var(--fs-caption);
    font-variant-numeric: tabular-nums;
  }
`;

// --- TopBar (see top-bar.ts) ---
// The title area takes what the end side leaves, down to --top-bar-title-min,
// and its title and the line under it end in an ellipsis. The end side holds
// what fits; the measuring row lays out every item the bar may show in a
// box of no size, so it is measured but adds no overflow. In the More menu, a
// widget's row is its label and its controls, on one line.
const TOP_BAR_CSS = `
  [data-boogy="top-bar"] {
    --top-bar-title-min: var(--tile-min);
    position: relative;
    display: flex;
    align-items: center;
    gap: var(--space-3);
    min-block-size: var(--control-lg);
    min-inline-size: 0;
  }
  [data-boogy="top-bar"] > [data-slot="leading"] { display: flex; flex: none; align-items: center; }
  [data-boogy="top-bar"] > [data-slot="heading"] { display: grid; flex: 1 1 0; min-inline-size: var(--top-bar-title-min); }
  [data-boogy="top-bar"] > [data-slot="heading"] > [data-slot="title"] {
    margin: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: var(--fs-title);
    font-weight: 600;
    line-height: 1.25;
  }
  [data-boogy="top-bar"] > [data-slot="heading"] > [data-slot="subtitle"] {
    margin: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: var(--text-2);
    font-size: var(--fs-caption);
  }
  [data-boogy="top-bar"] > [data-slot="actions"] { display: flex; flex: none; align-items: center; gap: var(--space-1); }
  /* Two plain selectors: a relative one (starting with >) is invalid inside
     :is(), whose forgiving list drops it, and the rule then matches nothing. */
  [data-boogy="top-bar"] > [data-slot="actions"] > [data-item],
  [data-boogy="top-bar"] > [data-slot="measure"] > div > [data-item] { display: flex; flex: none; align-items: center; }
  [data-boogy="top-bar"] > [data-slot="measure"] {
    position: absolute;
    inset-block-start: 0;
    inset-inline-start: 0;
    inline-size: 0;
    block-size: 0;
    overflow: hidden;
    visibility: hidden;
  }
  [data-boogy="top-bar"] > [data-slot="measure"] > div { display: flex; inline-size: max-content; gap: var(--space-1); }
  [data-boogy="menu-row"] { display: flex; align-items: center; justify-content: space-between; gap: var(--space-4); }
  [data-boogy="menu-row"]:focus-within { background: var(--fill-hover); }
  [data-boogy="menu-row"] > [data-slot="widget"] { display: flex; align-items: center; }
`;

export const COMPONENTS_CSS_PARTS = { PILL_CSS, BUTTON_CSS, DRAWER_CSS, POPOVER_CSS, MENU_CSS, SHEET_CSS, EMPTY_STATE_CSS, FIELD_CSS, AVATAR_CSS, SEEDED_ART_CSS, BUBBLE_CSS, INLINE_EDIT_CSS, SWATCH_CSS, TABS_CSS, SECTION_CSS, THUMBNAIL_CSS, TILE_CSS, LIST_CSS, NOTICE_CSS, INFO_LIST_CSS, DETAIL_HEADER_CSS, STACK_CSS, CARD_CSS, CAROUSEL_CSS, FIT_TEXT_CSS, FILL_GRID_CSS, SEGMENT_CSS, METER_CSS, SWITCH_CSS, CHOICE_GROUP_CSS, VISUALLY_HIDDEN_CSS, DATA_TABLE_CSS, STAT_CSS, COLUMN_CHART_CSS, TOP_BAR_CSS };

export const COMPONENTS_CSS = `${FILL_GRID_PROPERTIES}
@layer boogy.components {
${PILL_CSS}
${BUTTON_CSS}
${DRAWER_CSS}
${POPOVER_CSS}
${MENU_CSS}
${SHEET_CSS}
${EMPTY_STATE_CSS}
${FIELD_CSS}
${AVATAR_CSS}
${SEEDED_ART_CSS}
${BUBBLE_CSS}
${INLINE_EDIT_CSS}
${SWATCH_CSS}
${TABS_CSS}
${SECTION_CSS}
${THUMBNAIL_CSS}
${TILE_CSS}
${LIST_CSS}
${NOTICE_CSS}
${INFO_LIST_CSS}
${DETAIL_HEADER_CSS}
${STACK_CSS}
${CARD_CSS}
${CAROUSEL_CSS}
${FIT_TEXT_CSS}
${FILL_GRID_CSS}
${SEGMENT_CSS}
${METER_CSS}
${SWITCH_CSS}
${CHOICE_GROUP_CSS}
${VISUALLY_HIDDEN_CSS}
${DATA_TABLE_CSS}
${STAT_CSS}
${COLUMN_CHART_CSS}
${TOP_BAR_CSS}
}
`;
