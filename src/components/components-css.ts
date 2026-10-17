// Component styles, in their own cascade layer above the foundation's and below
// every app rule: an app's own CSS always wins without needing specificity.
// Every size is a multiple of the local --u and every colour a role token.

// The first and the last of an element's children, not counting a popover. A
// popover is mounted beside its trigger only while it is open, so a plain
// `:first-child`/`:last-child` would change what it matches the moment a menu
// opens, and whatever it styles (an edge's margin, a group's corner) would move.
const FIRST = ':nth-child(1 of :not([data-boogy="popover"]))';
const LAST = ':nth-last-child(1 of :not([data-boogy="popover"]))';
/** The ink on an accent fill: a deep shade of the accent's own hue. */
const ACCENT_INK = 'oklch(from var(--accent) 0.2 calc(c * 0.3) h)';

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
    /* ...and its glyph grows with it, or a 44px box holds a caption-sized
       glyph: an icon drawn at 1em takes the font size, the SDK's own glyph
       its width. */
    [data-boogy="button"][data-shape="icon"] {
      --_glyph: max(var(--icon-md), var(--icon-touch));
      min-width: var(--touch-min);
      font-size: var(--_glyph);
    }
    [data-boogy="button"][data-shape="icon"] > [data-boogy="glyph"] { width: var(--_glyph); height: var(--_glyph); }
    /* In a bar the bar sets the size: the touch minimum neither makes it
       taller nor spaces its tools apart (a small control is still the 24px
       target WCAG asks for), and an icon keeps its own size's glyph. */
    [data-boogy="top-bar"] [data-boogy="button"] { min-height: 0; }
    [data-boogy="top-bar"] [data-boogy="button"][data-shape="icon"] { min-width: 0; --_glyph: var(--icon-md); }
    [data-boogy="top-bar"] [data-boogy="button"][data-shape="icon"][data-size="sm"] { --_glyph: var(--icon-sm); }
  }

  /* A glyph the SDK draws: sized from the icon tokens. */
  [data-boogy="glyph"] { flex: none; width: var(--icon-md); height: var(--icon-md); }
  [data-boogy="glyph"][data-size="sm"] { width: var(--icon-sm); height: var(--icon-sm); }

  /* Zoom controls: two buttons a hair apart. */
  [data-boogy="zoom-controls"] { display: inline-flex; align-items: center; gap: var(--space-0); --slider-inline: var(--slider-length); --slider-gap-end: var(--space-2); }

  /* solid */
  [data-boogy="button"][data-variant="solid"] {
    background: var(--accent);
    color: ${ACCENT_INK};
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

  /* soft: a translucent fill of the ink at rest, a step stronger on hover and
     press; disabled is the shared dimming above. */
  [data-boogy="button"][data-variant="soft"] { background: var(--fill-selected); color: var(--text-1); }
  [data-boogy="button"][data-variant="soft"]:not(:disabled, [aria-disabled="true"]):hover { background: var(--fill-strong); }
  [data-boogy="button"][data-variant="soft"]:not(:disabled, [aria-disabled="true"]):active { background: var(--fill-strong); }
  [data-boogy="button"][data-variant="soft"][aria-pressed="true"] { background: var(--fill-strong); }

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

const BUTTON_GROUP_CSS = `
  /* A partitioned pill: buttons edge to edge, the group's outer ends taking
     the buttons' radius (full when rounded), every corner at a seam square, a
     faint hairline between neighbours. The corners are set on the buttons
     themselves, so nothing is clipped and each keeps its own focus ring. */
  [data-boogy="button-group"] { --_r: var(--radius-1); display: inline-flex; align-items: stretch; }
  [data-boogy="button-group"][data-rounded="true"] { --_r: var(--radius-full); }
  [data-boogy="button-group"] > [data-boogy="button"] { border-radius: 0; }
  [data-boogy="button-group"] > [data-boogy="button"]${FIRST} {
    border-start-start-radius: var(--_r);
    border-end-start-radius: var(--_r);
  }
  [data-boogy="button-group"] > [data-boogy="button"]${LAST} {
    border-start-end-radius: var(--_r);
    border-end-end-radius: var(--_r);
  }
  [data-boogy="button-group"] > [data-boogy="button"]:not(${FIRST}) {
    border-inline-start: var(--hairline) solid var(--edge-faint);
  }
  [data-boogy="button-group"] > [data-boogy="button"]:focus-visible { position: relative; z-index: 1; }
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
      /* A fixed column: the main area gives way, never the drawer, however wide
         the main area's content would like to be (a long line, a wide table). */
      flex: none;
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
    /* plain: docked, it sits on the page's own ground, its edge between them
       (a list beside the main one: a conversation's members). Over the main
       area, as an overlay, it keeps its ground, or the main area would show
       through it. */
    [data-boogy="drawer-layout"][data-collapse-at="${at}"] > [data-boogy="drawer"][data-variant="plain"] {
      background: transparent;
      backdrop-filter: none;
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
    /* Unless the head's toggle shows only while expanded (the strip unfolds
       from its foot): then nothing takes the title's place, and it keeps its
       logo at the strip's head, a link as before, its name hidden. */
    [data-collapse-at="${at}"][data-expanded="false"] > [data-boogy="drawer"] > [data-slot="head"]:has(> [data-role="drawer-toggle"][data-shown="expanded"]) > [data-boogy="drawer-item"][data-variant="title"] {
      display: flex;
      min-height: 0;
      padding-block: 0;
      background: transparent;
    }
    /* A rule under it, as under a section's glyph and count there: --space-3
       either side (below, the drawer's --space-1 gap and --space-2 more). */
    [data-collapse-at="${at}"][data-expanded="false"] > [data-boogy="drawer"] > [data-slot="head"]:has(> [data-role="drawer-toggle"][data-shown="expanded"]):has(> [data-boogy="drawer-item"][data-variant="title"]) {
      padding-block-end: var(--space-3);
      margin-block-end: var(--space-2);
      border-block-end: var(--rule);
    }
    /* A list on the strip (people, say): each item is its media alone, centred
       and no larger than an entry's mark, spaced by the list rather than by
       its own padding; an avatar or a thumbnail is exactly the mark's size,
       however small it is open (a compact list's xs). Its end (actions) has
       no room there. */
    [data-collapse-at="${at}"][data-expanded="false"] > [data-boogy="drawer"] [data-boogy="list"] { gap: var(--space-2); }
    [data-collapse-at="${at}"][data-expanded="false"] > [data-boogy="drawer"] [data-boogy="list-item"] { justify-content: center; padding: 0; }
    [data-collapse-at="${at}"][data-expanded="false"] > [data-boogy="drawer"] [data-boogy="list-item"] > [data-slot="media"] > * {
      max-width: var(--mark-lg);
      max-height: var(--mark-lg);
    }
    [data-collapse-at="${at}"][data-expanded="false"] > [data-boogy="drawer"] [data-boogy="list-item"] > [data-slot="media"] > [data-boogy="avatar"],
    [data-collapse-at="${at}"][data-expanded="false"] > [data-boogy="drawer"] [data-boogy="list-item"] > [data-slot="media"] > [data-boogy="thumbnail"] {
      width: var(--mark-lg);
      height: var(--mark-lg);
    }
    [data-collapse-at="${at}"][data-expanded="false"] > [data-boogy="drawer"] [data-boogy="list-item"] > [data-slot="end"] { display: none; }
    /* On the rail: an unread item a pip at the drawer's edge, the open one a
       taller pip, each standing out past the row across the drawer's padding
       (--space-2), so it is at the edge and clear of the media. */
    [data-collapse-at="${at}"][data-expanded="false"] > [data-boogy="drawer"] [data-boogy="list-item"] { position: relative; }
    [data-collapse-at="${at}"][data-expanded="false"] > [data-boogy="drawer"] [data-boogy="list-item"][data-unread]::before,
    [data-collapse-at="${at}"][data-expanded="false"] > [data-boogy="drawer"] [data-boogy="list-item"][aria-current="page"]::before {
      content: "";
      position: absolute;
      inset-inline-start: calc(-1 * var(--space-2));
      top: 50%;
      translate: 0 -50%;
      width: var(--pip);
      height: var(--space-2);
      border-start-end-radius: var(--radius-full);
      border-end-end-radius: var(--radius-full);
      background: var(--text-1);
    }
    [data-collapse-at="${at}"][data-expanded="false"] > [data-boogy="drawer"] [data-boogy="list-item"][aria-current="page"]::before { height: var(--space-5); }
    /* The open one is also the only one whole: in a list that has one, every
       other item's media is dimmed, and comes up under the pointer. No fill,
       no ring, no outline round it. */
    [data-collapse-at="${at}"][data-expanded="false"] > [data-boogy="drawer"] [data-boogy="list-item"][aria-current="page"] { background: transparent; }
    [data-collapse-at="${at}"][data-expanded="false"] > [data-boogy="drawer"] [data-boogy="list"]:has([aria-current="page"]) [data-boogy="list-item"]:not([aria-current="page"]) > [data-slot="media"] {
      opacity: 0.5;
      transition: opacity var(--dur-base) ease-out;
    }
    [data-collapse-at="${at}"][data-expanded="false"] > [data-boogy="drawer"] [data-boogy="list"]:has([aria-current="page"]) :is(button, a)[data-boogy="list-item"]:not([aria-current="page"]):hover > [data-slot="media"] { opacity: 1; }
    /* A section on the strip: its glyph over its meta, then a rule. The meta is
       trimmed to its letters, so the space above the rule is the head's padding
       and the space below it the section's own gap, the same token. Its action
       and description have no room there, and a section with neither a glyph
       nor a meta has no head there at all. */
    [data-collapse-at="${at}"][data-expanded="false"] > [data-boogy="drawer"] [data-boogy="section"] > [data-slot="head"] {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding-block-end: var(--space-3);
      border-block-end: var(--rule);
    }
    [data-collapse-at="${at}"][data-expanded="false"] > [data-boogy="drawer"] [data-boogy="section"] > [data-slot="head"]:not(:has(> [data-slot="header"] > [data-slot="glyph"])):not(:has(> [data-slot="header"] > [data-slot="meta"])) { display: none; }
    [data-collapse-at="${at}"][data-expanded="false"] > [data-boogy="drawer"] [data-boogy="section"] > [data-slot="head"] > :not([data-slot="header"]) { display: none; }
    [data-collapse-at="${at}"][data-expanded="false"] > [data-boogy="drawer"] [data-boogy="section"] > [data-slot="head"] > [data-slot="header"] {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: var(--space-2);
    }
    [data-collapse-at="${at}"][data-expanded="false"] > [data-boogy="drawer"] [data-boogy="section"] [data-slot="header"] > [data-slot="glyph"] { display: block; }
    [data-collapse-at="${at}"][data-expanded="false"] > [data-boogy="drawer"] [data-boogy="section"] [data-slot="header"] > [data-slot="meta"] { text-box: trim-both cap alphabetic; }
    [data-collapse-at="${at}"][data-expanded="false"] > [data-boogy="drawer"] [data-boogy="section"] [data-slot="separator"] { display: none; }
    /* The foot on the strip holds only what fits there, centred: toggles and
       entries. A toggle shown only collapsed shows here; one shown only
       expanded does not. */
    [data-collapse-at="${at}"][data-expanded="false"] > [data-boogy="drawer"] > [data-slot="foot"] { align-items: center; }
    /* A scrollbar would take the width the strip's marks need. It scrolls
       still, by wheel, touch and keyboard. */
    [data-collapse-at="${at}"][data-expanded="false"] > [data-boogy="drawer"] > [data-slot="body"] { scrollbar-width: none; }
    /* The body clips what it scrolls; on the strip it reaches across the
       drawer's padding to its edge, where an item's pip is drawn. */
    [data-collapse-at="${at}"][data-expanded="false"] > [data-boogy="drawer"] > [data-slot="body"] {
      margin-inline: calc(-1 * var(--space-2));
      padding-inline: var(--space-2);
    }
    /* A field in its head (a search) has no room on the strip. */
    [data-collapse-at="${at}"][data-expanded="false"] > [data-boogy="drawer"] > [data-slot="head"] [data-boogy="field"] { display: none; }
    [data-collapse-at="${at}"][data-expanded="false"] > [data-boogy="drawer"] > [data-slot="foot"] > :not([data-role="drawer-toggle"], [data-boogy="drawer-item"]) { display: none; }
    /* The toggles in this layout's own drawer only: a layout nested in its
       main area (members beside a conversation, inside rooms) keeps its own. */
    [data-collapse-at="${at}"][data-expanded="false"] > [data-boogy="drawer"] [data-role="drawer-toggle"][data-shown="collapsed"] { display: inline-flex; }
    [data-collapse-at="${at}"][data-expanded="false"] > [data-boogy="drawer"] [data-role="drawer-toggle"][data-shown="expanded"] { display: none; }
    /* The words with no room on the strip stay for assistive tech: an entry's
       label, a list item's text, a section's title. */
    [data-collapse-at="${at}"][data-expanded="false"] > [data-boogy="drawer"] [data-boogy="list-item"] > [data-slot="text"],
    [data-collapse-at="${at}"][data-expanded="false"] > [data-boogy="drawer"] [data-boogy="section"] [data-slot="header"] > [data-slot="title"],
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
    /* The drawer's docked width, defined once here: a width the person drags
       is written on the layout over it. Its other dimensions are on the drawer
       itself (below), so they follow the drawer's own unit. */
    --drawer-width: calc(var(--u) * 15);
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
    /* Clipped, and never scrolled: a control focused past its edge (or the
       off-canvas drawer) would otherwise scroll the whole layout over by that
       much, and leave it there. */
    overflow: hidden;
    overflow: clip;
  }
  [data-boogy="drawer-layout"][data-side="end"] { flex-direction: row-reverse; }
  [data-boogy="drawer-main"] { flex: 1 1 auto; min-width: 0; min-height: 0; }
  /* A layout nested in another's main area (members beside a conversation,
     inside rooms) fills it. */
  [data-boogy="drawer-main"] > [data-boogy="drawer-layout"] { block-size: 100%; }

  [data-boogy="drawer"] {
    /* Its overlay width and collapsed strip, in its OWN unit: a drawer that
       sets its own scale keeps these with it. The strip holds one large mark
       with the drawer's padding either side. */
    --drawer-overlay-width: calc(var(--u) * 18);
    --drawer-strip-width: calc(var(--mark-lg) + 2 * var(--space-2) + 1px); /* + the 1px edge: the drawer is border-box */
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
    background: var(--drawer-ground, var(--ground-raised));
    /* Its edge, as when docked: over a page of its own ground (a dark one,
       where no shadow shows), the edge is what tells the two apart. */
    border-inline-end: 1px var(--drawer-edge-style, solid) var(--drawer-edge);
    box-shadow: var(--overlay-shadow);
    translate: -100% 0;
    visibility: hidden;
    transition: translate var(--dur-base) ease-out, visibility 0s linear var(--dur-base);
  }
  /* Over the board's background a drawer is a frosted panel: its ground, partly
     see-through, over a blur of the board, so the board shows through without
     costing its text. Elsewhere it is solid. */
  :root[data-board-background] [data-boogy="drawer"] {
    background: color-mix(in oklch, var(--drawer-ground, var(--ground-raised)) var(--panel-frost), transparent);
    backdrop-filter: blur(var(--blur-md));
  }
  /* With a head or a foot (Drawer's \`head\`, \`foot\`), the drawer's body
     scrolls and the drawer does not: the head stays at the top and the foot
     at the bottom edge, on the drawer's own ground, and what scrolls stops at
     them rather than passing under. The body lays its content out as the
     drawer would. With a foot the drawer gives up its bottom padding, so the
     foot sits flush with the edge; the head keeps the section's gap below it
     (its padding and the drawer's own gap together). */
  [data-boogy="drawer"]:has(> [data-slot="body"]) { overflow-y: hidden; }
  [data-boogy="drawer"]:has(> [data-slot="foot"]) { padding-block-end: 0; }
  [data-boogy="drawer"] > [data-slot="head"] { flex: none; padding-block-end: var(--space-2); }
  /* A head that holds the drawer's title entry lays it and what follows (its
     own toggle) in one row: the title takes the room, the toggle sits beside
     it, never inside the title's link. */
  [data-boogy="drawer"] > [data-slot="head"]:has(> [data-boogy="drawer-item"][data-variant="title"]) {
    display: flex;
    align-items: center;
    gap: var(--space-1);
  }
  [data-boogy="drawer"] > [data-slot="head"] > [data-boogy="drawer-item"][data-variant="title"] { flex: 1 1 auto; min-width: 0; }
  [data-boogy="drawer"] > [data-slot="body"] {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    flex: 1 1 auto;
    min-block-size: 0;
    overflow-x: hidden;
    overflow-y: auto;
  }
  [data-boogy="drawer"] > [data-slot="foot"] {
    display: flex;
    flex: none;
    flex-direction: column;
    gap: var(--space-2);
    padding-block: var(--space-2);
    border-block-start: var(--rule);
  }
  /* A toggle shown in one state (DrawerToggle's \`shown\`): a collapsed-only
     one shows only on the docked strip (below), so it is hidden here, which
     covers an open overlay and an expanded drawer. */
  [data-boogy="drawer-layout"] [data-role="drawer-toggle"][data-shown="collapsed"] { display: none; }
  [data-boogy="drawer-layout"][data-side="end"] > [data-boogy="drawer"] {
    inset-inline-start: auto;
    inset-inline-end: 0;
    translate: 100% 0;
    border-inline-end: none;
    border-inline-start: 1px var(--drawer-edge-style, solid) var(--drawer-edge);
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
  /* A picture as the mark (a logo, an avatar) fills it, whatever size it was
     made at. */
  [data-boogy="drawer-item"] > [data-slot="mark"] > [data-boogy="thumbnail"],
  [data-boogy="drawer-item"] > [data-slot="mark"] > [data-boogy="avatar"] { width: 100%; height: 100%; }
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
  /* The side is the toggle's own drawer's, not an ancestor's: a toggle for
     the rooms can sit inside a members layout on the end side. */
  [data-role="drawer-toggle"][data-side="end"] > [data-slot="chevron"] { scale: -1 1; }
  [data-role="drawer-toggle"][data-side="end"][aria-expanded="false"] > [data-slot="chevron"] { scale: 1 1; }
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
  /* flat: edged, a slight radius, a small shadow (--menu-shadow, not the
     raised popover's large one), and frosted — its ground (by
     default --ground-frost, a glass grey) a little see-through
     (--popover-frost) over a blur of what is behind it. Its
     colours stay the app's (--popover-ground, --popover-edge), its radii too
     (--popover-radius, --popover-row-radius). */
  [data-boogy="popover"][data-variant="flat"] {
    border-radius: var(--popover-radius, var(--radius-1));
    box-shadow: var(--menu-shadow);
    background: color-mix(in oklch, var(--popover-ground, var(--ground-frost)) var(--popover-frost), transparent);
    backdrop-filter: blur(var(--blur-md));
  }
  [data-boogy="popover"][data-variant="flat"] :is([data-boogy="menu-item"], [data-boogy="menu-row"]) { border-radius: var(--popover-row-radius, var(--radius-1)); }
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
    backdrop-filter: none;
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
    gap: var(--hairline);
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
    /* The two rows packed in the middle: with no description the label is
       centred, level with an icon or a widget row's label, not above an
       empty row that took half of the height. */
    align-content: center;
    align-items: center;
    column-gap: var(--space-3);
    /* A press acts on it: the pointer (a disabled one has the arrow, below). */
    cursor: pointer;
    outline: none;
    user-select: none;
  }
  [data-boogy="menu-item"]:focus { background: var(--fill-hover); }
  [data-boogy="menu-item"][data-variant="danger"] { color: var(--danger); }
  [data-boogy="menu-item"][data-variant="danger"]:focus {
    background: color-mix(in oklch, var(--danger) 16%, transparent);
  }
  [data-boogy="menu-item"][data-disabled="true"] { opacity: 0.45; cursor: default; }
  [data-boogy="menu-item"] > [data-slot="label"] { grid-area: label; min-width: 0; }
  /* A leading icon or swatch: a column of its own, only on an item that has
     one, so a menu without icons keeps its labels against the edge. */
  [data-boogy="menu-item"]:has(> [data-slot="icon"]) {
    grid-template-columns: auto 1fr auto auto;
    grid-template-areas: "icon label kbd indicator" "icon description kbd indicator";
  }
  /* An item's icon and a widget row's icon: one size and ink. */
  [data-boogy="menu-item"] > [data-slot="icon"], [data-boogy="menu-row"] > [data-slot="icon"] { display: flex; color: var(--text-2); }
  [data-boogy="menu-item"] > [data-slot="icon"] { grid-area: icon; }
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
  /* A row that opens more content to its side ends in a chevron, in the
     indicator's column, a step quieter than its label. While what it opened
     is open the row keeps the focused look, so the content reads as coming
     from it. */
  [data-boogy="menu-item"] > [data-slot="submenu-indicator"] {
    grid-area: indicator;
    display: flex;
    color: var(--text-3);
  }
  [data-boogy="menu-item"][aria-expanded="true"] { background: var(--fill-hover); }
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
  /* A page showing the board's background has a transparent --ground, so a
     sheet left to it would show the screen it covers at full strength: it
     covers with the opaque solid ground instead. A page's own --sheet-ground
     still wins (one that hides what its sheet covers may set transparent). */
  :root[data-board-background] [data-boogy="sheet"] { background: var(--sheet-ground, var(--ground-solid)); }
  /* The head and the foot are their own height whatever the body holds: a
     body far taller than the sheet scrolls, and never squeezes them (as
     shrinkable flex items, a long body took their padding away). */
  [data-boogy="sheet"] > [data-slot="head"] {
    flex: none;
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
  /* A TopBar with \`shadow\` as the head: the shadow is the head's, cast from
     its edge rather than from inside its padding, over the body that scrolls
     under it. */
  [data-boogy="sheet"] > [data-slot="head"]:has(> :is([data-boogy="top-bar"], [data-boogy="top-bar-stack"])[data-shadow]) {
    position: relative;
    z-index: 1;
    box-shadow: var(--bar-shadow);
  }
  [data-boogy="sheet"] > [data-slot="head"] > :is([data-boogy="top-bar"], [data-boogy="top-bar-stack"])[data-shadow] { box-shadow: none; }
  /* A head of the caller's own: the head's frame (its edge and padding), and
     none of the title's type. What it holds takes the head's width. */
  [data-boogy="sheet"] > [data-slot="head"][data-head="own"] { font-size: var(--fs-body); font-weight: 400; }
  [data-boogy="sheet"] > [data-slot="head"][data-head="own"] > * { flex: 1 1 auto; min-width: 0; }
  /* A TopBar head is the bar's own height: the head adds no padding above or
     below it. */
  [data-boogy="sheet"] > [data-slot="head"]:has(> :is([data-boogy="top-bar"], [data-boogy="top-bar-stack"])) { padding: 0; }
  /* An edge-to-edge bar pads its own ends: as a sheet's head, and with \`inset\`. */
  [data-boogy="sheet"] > [data-slot="head"] > [data-boogy="top-bar"],
  [data-boogy="sheet"] > [data-slot="head"] > [data-boogy="top-bar-stack"] > [data-boogy="top-bar"],
  [data-boogy="top-bar"][data-inset] { padding-inline: var(--top-bar-inset); }
  /* AN EDGE-TO-EDGE BAR'S END BUTTONS line their glyphs up with its padding,
     the edge the page's content keeps: a Back or a More reaches into the
     padding by the space around its glyph, rather than drawing that space
     inside it. */
  :is([data-boogy="sheet"] > [data-slot="head"] > [data-boogy="top-bar"], [data-boogy="sheet"] > [data-slot="head"] > [data-boogy="top-bar-stack"] > [data-boogy="top-bar"], [data-boogy="top-bar"][data-inset])
    > [data-slot="leading"] > [data-boogy="button"][data-shape="icon"]${FIRST} {
    margin-inline-start: calc((var(--_glyph, var(--icon-md)) - var(--_h)) / 2);
  }
  :is([data-boogy="sheet"] > [data-slot="head"] > [data-boogy="top-bar"], [data-boogy="sheet"] > [data-slot="head"] > [data-boogy="top-bar-stack"] > [data-boogy="top-bar"], [data-boogy="top-bar"][data-inset])
    > [data-slot="actions"] > [data-boogy="button"][data-shape="icon"]${LAST} {
    margin-inline-end: calc((var(--_glyph, var(--icon-md)) - var(--_h)) / 2);
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
    flex: none;
    display: flex;
    justify-content: flex-end;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-3) var(--space-4);
    border-top: var(--rule);
  }
  /* A destructive action (Delete, Remove) goes first, apart from the rest at
     the end, in a sheet's foot and a form's. */
  :is([data-boogy="sheet"] > [data-slot="foot"], [data-boogy="form"] [data-slot="actions"]) > [data-role="destructive"] {
    order: -1;
    margin-inline-end: auto;
  }
  /* A field in the foot (a composer) takes the foot's width — and IS the bar:
     the foot becomes a light, frosted well (--composer-ground), the field's own
     frame dissolves into it, and with no frame left the foot's top edge shows
     focus. A field of the \`bar\` variant is the same bar on a page that is not
     a sheet: it is its own foot (below), and shares every rule here. */
  [data-boogy="sheet"] > [data-slot="foot"] > [data-boogy="field"] { flex: 1 1 auto; min-width: 0; }
  [data-boogy="field"][data-variant="bar"],
  [data-boogy="sheet"] > [data-slot="foot"]:has(> [data-boogy="field"]) {
    background: var(--composer-ground);
    backdrop-filter: blur(var(--blur-md));
  }
  [data-boogy="field"][data-variant="bar"]:focus-within,
  [data-boogy="sheet"] > [data-slot="foot"]:has(> [data-boogy="field"]):focus-within { border-top-color: var(--accent); }
  [data-boogy="field"][data-variant="bar"] > [data-slot="group"],
  [data-boogy="sheet"] > [data-slot="foot"] > [data-boogy="field"] > [data-slot="group"] {
    border: none;
    background: transparent;
    border-radius: 0;
    box-shadow: none;
  }
  [data-boogy="field"][data-variant="bar"] > [data-slot="group"]:focus-within,
  [data-boogy="sheet"] > [data-slot="foot"] > [data-boogy="field"] > [data-slot="group"]:focus-within { outline: none; }
  /* The bar variant is its own foot: the sheet foot's padding and top rule,
     and its own height whatever is above it. */
  [data-boogy="field"][data-variant="bar"] {
    flex: none;
    padding: var(--space-3) var(--space-4);
    border-top: var(--rule);
  }
  /* Put in a sheet's foot, which is already the bar, it is not a second one. */
  [data-boogy="sheet"] > [data-slot="foot"] > [data-boogy="field"][data-variant="bar"] {
    background: none;
    backdrop-filter: none;
    padding: 0;
    border-top: none;
  }
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
  /* The placeholder in the theme's quiet text, so it follows the theme's tint
     (and a board's hue, where a host re-derives --text-3) rather than staying
     the browser's own grey. Opaque: Firefox dims it with opacity otherwise. */
  [data-boogy="field"] [data-slot="control"]::placeholder { color: var(--text-3); opacity: 1; }
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
  /* What ends the field (a unit, a send button) keeps off its frame. */
  [data-boogy="field"] > [data-slot="group"] > [data-slot="suffix"] { display: flex; flex: none; padding-inline-end: var(--space-1); }
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
  /* Its padding centres one line in a control's height, its border box
     included, so a one-line composer is exactly as tall as the send button's
     row and its text sits level with the button. */
  [data-boogy="field"] > [data-slot="group"] > textarea[data-slot="control"] {
    align-self: stretch;
    box-sizing: border-box;
    padding-block: calc((var(--control-md) - 1lh) / 2);
    resize: none;
    field-sizing: content;
    /* Eight lines, whole: seven lines and the one a control's height holds
       with its padding (the box is border-box). */
    max-height: calc(7lh + var(--control-md));
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
  [data-boogy="field"] > [data-slot="message"] {
    color: var(--text-3);
    font-size: var(--fs-caption);
  }
  [data-boogy="field"] > [data-slot="message"]:empty { display: none; }
  /* An image field: the image, then its buttons, wrapping under it when narrow. */
  [data-boogy="field"] > [data-slot="picker"] { display: flex; flex-wrap: wrap; align-items: center; gap: var(--space-3); }
  [data-boogy="field"] > [data-slot="picker"] > [data-slot="buttons"] { display: flex; flex-wrap: wrap; gap: var(--space-2); }
  /* A limit's count sits at the end of the line, after any hint. */
  [data-boogy="field"] > [data-slot="message"]:has(> [data-slot="count"]) { display: flex; gap: var(--space-2); }
  [data-boogy="field"] > [data-slot="message"] > [data-slot="count"] {
    flex: none;
    margin-inline-start: auto;
    font-variant-numeric: tabular-nums;
  }
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
  /* A section's glyph shows only where its heading has no room for its title
     (a drawer folded to its strip: the drawer rules above). */
  [data-boogy="section"] [data-slot="header"] > [data-slot="glyph"] { display: none; }
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
  /* Padded: the whole image, on the fill, clear of the edges (a logo). None:
     the image edge to edge on nothing (its own transparency shows through). */
  /* An eighth or so of each size (a padding in % is a share of the PARENT's
     width, so it is a token per size). */
  [data-boogy="thumbnail"][data-ground="padded"] { box-sizing: border-box; padding: var(--space-2); }
  [data-boogy="thumbnail"][data-ground="padded"][data-size="sm"] { padding: var(--space-1); }
  [data-boogy="thumbnail"][data-ground="padded"][data-size="lg"] { padding: var(--space-3); }
  [data-boogy="thumbnail"][data-ground="padded"] > img { object-fit: contain; }
  [data-boogy="thumbnail"][data-ground="none"] { background: transparent; }
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
    /* A small shadow, lifting it off what it sits on (its overflow clips its
       contents, never its own shadow). */
    box-shadow: var(--avatar-shadow);
    color: oklch(0.98 0 0);
    font-weight: 600;
    line-height: 1;
    user-select: none;
    /* Its own container, so the initials can be a share of its size. */
    container-type: size;
  }
  /* Flat art: the seed's one bright colour (set on the element), initials in
     its ink. */
  [data-boogy="avatar"][data-art="flat"] { background: var(--avatar-fill); color: var(--avatar-ink); }
  [data-boogy="avatar"][data-variant="circle"] { border-radius: var(--radius-full); }
  /* Rounded is only softened, as a thumbnail's corners are. */
  [data-boogy="avatar"][data-variant="rounded"] { border-radius: var(--radius-1); }
  [data-boogy="avatar"][data-variant="rounded"][data-size="lg"] { border-radius: var(--radius-2); }
  [data-boogy="avatar"][data-size="xs"] { width: var(--thumb-xs); height: var(--thumb-xs); }
  [data-boogy="avatar"][data-size="sm"] { width: var(--thumb-sm); height: var(--thumb-sm); }
  [data-boogy="avatar"][data-size="md"] { width: var(--thumb-md); height: var(--thumb-md); }
  [data-boogy="avatar"][data-size="lg"] { width: var(--thumb-lg); height: var(--thumb-lg); }
  [data-boogy="avatar"] > img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
  /* The initials: 42% of the avatar's diameter at every size. */
  [data-boogy="avatar"] > [data-slot="initials"] { position: relative; font-size: 42cqmin; }
`;

// Thread and Bubble (see bubble.ts): a column of messages, each on its side.
// The other person's on a faint fill with a faint edge, yours on the soft
// accent — both in the ink, so either reads on any ground behind. Each ground
// is a notch more solid than the shared fill it echoes, so a bubble holds
// over a busy background. The foot corner on the sender's side is nearly
// square, pointing at whose it is. A thread asked for a shadow
// (\`data-shadow\`) lifts every bubble in it off what it lies on.
const BUBBLE_CSS = `
  [data-boogy="thread"] {
    display: flex;
    flex-direction: column;
    gap: var(--thread-gap, var(--space-2));
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
    background: var(--bubble-ground-start);
    color: var(--text-1);
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }
  [data-boogy="bubble"][data-side="start"] > [data-slot="body"] { border-end-start-radius: var(--radius-1); }
  [data-boogy="bubble"][data-side="end"] > [data-slot="body"] {
    border-color: transparent;
    border-end-end-radius: var(--radius-1);
    background: var(--bubble-ground-end);
  }
  [data-boogy="thread"][data-shadow] [data-boogy="bubble"] > [data-slot="body"] { box-shadow: var(--bubble-shadow); }
  /* ThreadView: the scroller around a thread read a page at a time. Only up
     and down, never sideways; the browser's own scroll anchoring off, since
     the view keeps the reader's place by the message they are reading. A
     page, and each item in it, is a column as the thread is, so a bubble
     sits at its side; a page let go is a spacer of its height. */
  [data-boogy="thread-view"] {
    box-sizing: border-box;
    flex: 1 1 auto;
    min-block-size: 0;
    overflow-x: hidden;
    overflow-y: auto;
    overflow-anchor: none;
    overscroll-behavior: contain;
    padding: var(--space-3) var(--space-4);
  }
  [data-boogy="thread"] > [data-slot="page"] { display: flex; flex-direction: column; gap: var(--thread-gap, var(--space-2)); }
  [data-boogy="thread"] > [data-slot="page"] > [data-slot="item"] { display: flex; flex-direction: column; min-inline-size: 0; }
  [data-boogy="bubble"] > [data-slot="meta"] {
    display: inline-flex;
    align-items: center;
    gap: var(--space-1);
    padding-inline: var(--space-1);
    color: var(--text-3);
    font-size: var(--fs-caption);
  }
  /* A message's actions (Bubble's \`actions\`), at the end of its meta line:
     on touch, always there; where a mouse can hover, shown on hover or when
     something in the bubble has focus (a keyboard reaches them too). */
  [data-boogy="bubble"] [data-slot="actions"] { display: inline-flex; align-items: center; gap: var(--space-1); }
  @media (hover: hover) and (pointer: fine) {
    [data-boogy="bubble"] [data-slot="actions"] { opacity: 0; transition: opacity var(--dur-fast) ease-out; }
    [data-boogy="bubble"]:is(:hover, :focus-within) [data-slot="actions"] { opacity: 1; }
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
/** A title that carries media before its words (an avatar by a name, a
 *  glyph before a room's): one row, centred on the line, the media its own
 *  size and the words truncating as a plain title's do. Not clipped, so the
 *  media's shadow shows; the words truncate themselves. A glyph reads with
 *  the words, so it sits closer than a picture does. */
function titleWithMedia(title: string, gap: string): string {
  const has = `${title}:has(> :is([data-boogy="avatar"], [data-boogy="thumbnail"], [data-boogy="glyph"]))`;
  return `
  ${has} {
    display: flex;
    align-items: center;
    gap: ${gap};
    overflow: visible;
  }
  ${has} > [data-boogy] { flex: none; }
  ${has} > :not([data-boogy]) {
    min-inline-size: 0;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  ${title}:has(> [data-boogy="glyph"]) { gap: var(--space-1); }`;
}

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
  /* Unread: a bolder title, and an accent dot before its meta. */
  [data-boogy="list-item"][data-unread] [data-slot="title"] { font-weight: 600; color: var(--text-1); }
  /* The one open now: selected, its title full strength. */
  [data-boogy="list-item"][aria-current="page"] { background: var(--fill-selected); }
  [data-boogy="list-item"][aria-current="page"] [data-slot="title"] { font-weight: 600; color: var(--text-1); }
  /* nav: the place open now is filled with the accent, everything on it in the
     accent's ink (the solid button's). */
  [data-boogy="list"][data-variant="nav"] [data-boogy="list-item"][aria-current="page"] {
    background: var(--accent);
    color: ${ACCENT_INK};
  }
  [data-boogy="list"][data-variant="nav"] [data-boogy="list-item"][aria-current="page"] :is([data-slot="title"], [data-slot="meta"], [data-slot="subtitle"]) { color: inherit; }
  [data-boogy="list"][data-variant="nav"] :is(button, a)[data-boogy="list-item"][aria-current="page"]:hover { background: var(--accent-hover); }
  /* Compact: one line per item, closer together (a sidebar's list). */
  [data-boogy="list"][data-density="compact"] [data-boogy="list-item"] { padding: var(--space-1) var(--space-2); }
  [data-boogy="list"][data-density="compact"] [data-boogy="list-item"] [data-slot="title"] { font-size: var(--fs-detail); }
  [data-boogy="list-item"] [data-slot="unread"] {
    flex: none;
    align-self: center;
    width: var(--space-2);
    height: var(--space-2);
    border-radius: var(--radius-full);
    background: var(--accent);
  }
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
${titleWithMedia('[data-boogy="list-item"] [data-slot="title"]', 'var(--space-1)')}
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
  /* With an action: the words, and the action at the end of the line. */
  [data-boogy="notice"]:has(> [data-slot="action"]) { display: flex; align-items: center; justify-content: space-between; gap: var(--space-2); }
  [data-boogy="notice"] > [data-slot="action"] { flex: none; }
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

// --- ColorPicker (see color-picker.ts) ---
// Sections, each inside the picker's own padding, a hairline between each two
// running the picker's full width: the swatches, the custom colour, the
// transparency slider.
//
//   * A swatch is a square chip of its colour, a hairline inside its edge so a
//     chip close to the ground (black on a dark menu, white on a light one)
//     still reads as a chip. The chosen chip is ringed in the ink with a ring
//     of the ground inside that, so the ring reads on any colour, light or
//     dark; the custom colour's preview takes the same rings when a custom
//     colour is the one chosen.
//   * The area is white to the pure hue across and clear to black down: the
//     HSV model drawn. Its gradients, and the hue strip's rainbow, are the
//     only colours named here, and each is defined once on the picker.
//   * Every thumb is one lens: a hollow ring as tall as the strips, framing
//     the colour under it, so what shows inside the ring is the colour you
//     get. A ring of the ground between two hairlines of the ink reads on
//     white and on black alike.
//   * Corners are one knob, --color-picker-radius: small, and square under a
//     flat popover.
//
// A range's track and thumb are styled once per engine (a rule naming another
// engine's pseudo-element is dropped whole), so each is written once below and
// stamped out for both.
const PICKER = '[data-boogy="color-picker"]';
const SAMPLES = '[data-boogy="sample-grid"]';
// The size controls' slider shares the picker's track and thumb.
const ZOOM_SLIDER = '[data-boogy="zoom-controls"] > [data-slot="slider"]';
// A Slider (slider.ts), the picker's transparency slider among them.
const SLIDER = '[data-boogy="slider"]';
const SLIDERS = `:is(${PICKER} [data-slot="hue"], ${SLIDER} > [data-slot="input"], ${ZOOM_SLIDER})`;
const LENS = `
    box-sizing: border-box;
    inline-size: var(--slider-track);
    block-size: var(--slider-track);
    border: var(--ring) solid var(--ground-solid);
    border-radius: var(--radius-full);
    box-shadow: 0 0 0 var(--hairline) var(--text-1), inset 0 0 0 var(--hairline) var(--text-1);
    background: transparent;`;
const pickerTrack = (pseudo: string) => `
  ${SLIDERS}${pseudo} {
    box-sizing: border-box;
    block-size: var(--slider-track);
    border-radius: var(--color-picker-radius, var(--radius-1));
    box-shadow: inset 0 0 0 var(--hairline) var(--edge);
  }
  ${ZOOM_SLIDER}${pseudo} { background: var(--fill-selected); }
  /* --slider-paint: the track's own paint, set on the Slider (a hue strip's rainbow). */
  ${SLIDER} > [data-slot="input"]${pseudo} { background: var(--slider-paint, var(--fill-selected)); }
  ${PICKER} [data-slot="hue"]${pseudo} { background: var(--color-picker-rainbow); }
  ${PICKER} [data-slot="opacity"] > [data-slot="input"]${pseudo} {
    background: linear-gradient(to right, var(--color-picker-current), transparent), var(--checker) 0 0 / var(--space-2) var(--space-2);
  }`;
// A slider's thumb: a plain filled circle in the ink, a hairline of the
// ground around it so it reads on a light strip and a dark one.
const DOT = `
    box-sizing: border-box;
    inline-size: var(--slider-track);
    block-size: var(--slider-track);
    border: 0;
    border-radius: var(--radius-full);
    background: var(--slider-thumb, var(--text-1));
    box-shadow: 0 0 0 var(--hairline) var(--ground-solid);`;
const pickerThumb = (pseudo: string, reset = '') => `
  ${SLIDERS}${pseudo} {${reset}${DOT}
  }
  /* A thumb in the slider's own colour (--slider-thumb) is ringed in the ink,
     so a dark colour reads on a dark track and a light one on a light track. */
  ${SLIDER} > [data-slot="input"][data-thumb]${pseudo} { border: var(--ring) solid var(--text-1); }`;
const COLOR_PICKER_CSS = `
  ${PICKER} {
    --color-picker-radius: var(--radius-1);
    --color-picker-area-ratio: 2 / 1;
    /* The HSV model: the hue circle, and white and black at the ends of the
       area. --color-picker-hue (the pure hue) and --color-picker-current (the
       colour shown) are set on the picker as it changes. */
    --color-picker-rainbow: linear-gradient(to right, red, yellow, lime, cyan, blue, magenta, red);
    --color-picker-tint: linear-gradient(to right, white, var(--color-picker-hue));
    --color-picker-shade: linear-gradient(to top, black, transparent);
    display: grid;
    box-sizing: border-box;
  }
  [data-boogy="popover"][data-variant="flat"] ${PICKER} { --color-picker-radius: 0; }
  ${PICKER} > [data-slot] { padding: var(--space-3); }
  ${PICKER} > [data-slot] + [data-slot] { border-top: var(--rule); }

  /* Accordion: a column of native details, a rule between each two. A trigger
     is a large control holding the label, a trailing note pushed to the end
     and a chevron that turns as the item opens, after an optional icon; a
     nested level is a step quieter and indented beside a guide line. */
  [data-boogy="accordion"] { display: flex; flex-direction: column; min-inline-size: 0; }
  [data-boogy="accordion"] > [data-slot="item"] + [data-slot="item"] { border-top: var(--rule); }
  [data-boogy="accordion"] > [data-slot="item"] > [data-slot="trigger"] {
    list-style: none;
    display: flex;
    align-items: center;
    gap: var(--space-2);
    min-block-size: var(--control-lg);
    padding-inline: var(--space-3);
    border-radius: var(--radius-1);
    color: var(--text-1);
    font-weight: 600;
    cursor: pointer;
    user-select: none;
  }
  [data-boogy="accordion"] > [data-slot="item"] > [data-slot="trigger"]::-webkit-details-marker { display: none; }
  [data-boogy="accordion"] > [data-slot="item"] > [data-slot="trigger"]:hover { background: var(--fill-hover); }
  [data-boogy="accordion"] > [data-slot="item"] > [data-slot="trigger"]:focus-visible {
    outline: var(--ring) solid var(--ring-color);
    outline-offset: calc(-1 * var(--ring));
  }
  [data-boogy="accordion"] > [data-slot="item"] > [data-slot="trigger"] > [data-slot="icon"] {
    flex: none;
    display: inline-flex;
    color: var(--text-2);
  }
  [data-boogy="accordion"] > [data-slot="item"] > [data-slot="trigger"] > [data-slot="label"] { min-inline-size: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  [data-boogy="accordion"] > [data-slot="item"] > [data-slot="trigger"] > [data-slot="meta"] {
    margin-inline-start: auto;
    color: var(--text-2);
    font-size: var(--fs-detail);
    font-weight: 400;
    font-variant-numeric: tabular-nums;
  }
  [data-boogy="accordion"] > [data-slot="item"] > [data-slot="trigger"] > [data-slot="chevron"] {
    flex: none;
    color: var(--text-2);
    transition: rotate var(--dur-base) ease-out;
  }
  [data-boogy="accordion"] > [data-slot="item"] > [data-slot="trigger"]:not(:has(> [data-slot="meta"])) > [data-slot="chevron"] { margin-inline-start: auto; }
  [data-boogy="accordion"] > [data-slot="item"][open] > [data-slot="trigger"] > [data-slot="chevron"] { rotate: 90deg; }
  @media (prefers-reduced-motion: reduce) {
    [data-boogy="accordion"] > [data-slot="item"] > [data-slot="trigger"] > [data-slot="chevron"] { transition: none; }
  }
  [data-boogy="accordion"] > [data-slot="item"] > [data-slot="content"] { padding-block-end: var(--space-2); }
  /* A nested level hangs from a guide line down its side, as a file tree
     does: from under the parent's label (the trigger's own inset), or under
     the middle of its icon when it has one, in the strong edge so it reads
     as a guide on a dark ground. Its items stand a gap clear of the line, so
     a row's hover fill and the rules between rows never touch it. */
  [data-boogy="accordion"] [data-boogy="accordion"] {
    margin-inline-start: var(--space-3);
    border-inline-start: 1px solid var(--edge-strong);
    padding-inline-start: var(--space-2);
  }
  [data-boogy="accordion"] > [data-slot="item"]:has(> [data-slot="trigger"] > [data-slot="icon"]) > [data-slot="content"] > [data-boogy="accordion"] {
    margin-inline-start: calc(var(--space-3) + var(--icon-md) / 2);
  }
  [data-boogy="accordion"] [data-boogy="accordion"] > [data-slot="item"] > [data-slot="trigger"] {
    min-block-size: var(--control-md);
    font-weight: 500;
  }

  /* SampleGrid: tiles the app paints, in columns, scrolling past \`rows\`
     of them. Padded by a ring's width, so the scroll box does not clip the
     chosen or focused tile's ring at its edges. Its tiles' hover, chosen and
     focus looks are the swatches' (below). */
  ${SAMPLES} {
    --sample-grid-radius: var(--radius-1);
    display: grid;
    grid-template-columns: repeat(var(--sample-grid-columns), minmax(0, 1fr));
    grid-auto-rows: var(--sample-md);
    gap: var(--space-1);
    max-block-size: calc(var(--sample-grid-rows) * (var(--sample-md) + var(--space-1)) - var(--space-1));
    overflow-y: auto;
    overscroll-behavior: contain;
    padding: var(--ring);
  }
  /* rows="all": as tall as its tiles; what holds it scrolls. */
  ${SAMPLES}[data-rows="all"] { max-block-size: none; overflow-y: visible; }
  [data-boogy="popover"][data-variant="flat"] ${SAMPLES} { --sample-grid-radius: 0; }
  ${SAMPLES} > [data-slot="sample"] {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
    border: var(--rule);
    border-radius: var(--sample-grid-radius);
    cursor: pointer;
  }

  ${PICKER} > [data-slot="swatches"] {
    display: grid;
    grid-template-columns: repeat(var(--color-picker-columns), minmax(var(--chip-md), 1fr));
    gap: var(--space-0);
  }
  ${PICKER} [data-slot="swatch"] {
    box-sizing: border-box;
    aspect-ratio: 1;
    margin: 0;
    padding: 0;
    border: var(--rule);
    border-radius: var(--color-picker-radius);
    background: var(--swatch-color, transparent);
    cursor: pointer;
  }
  ${SAMPLES} > [data-slot="sample"]:hover,
  ${PICKER} [data-slot="swatch"]:hover { border-color: var(--text-1); }
  /* Chosen: a ring of the ink for its edge, a ring of the ground inside it. */
  ${SAMPLES} > [data-slot="sample"][aria-pressed="true"],
  ${PICKER} :is([data-slot="swatch"][aria-pressed="true"], [data-slot="custom"][data-pressed="true"] [data-slot="preview"]) {
    border: var(--ring) solid var(--text-1);
    box-shadow: inset 0 0 0 var(--ring) var(--ground-solid);
  }
  ${SAMPLES} > [data-slot="sample"]:focus-visible,
  ${PICKER} [data-slot="swatch"]:focus-visible {
    position: relative;
    z-index: 1;
    outline: var(--ring) solid var(--ring-color);
    outline-offset: 0;
  }

  ${PICKER} > [data-slot="custom"] {
    display: grid;
    gap: var(--space-2);
  }
  ${PICKER} [data-slot="area"] {
    position: relative;
    aspect-ratio: var(--color-picker-area-ratio);
    border-radius: var(--color-picker-radius);
    background: var(--color-picker-shade), var(--color-picker-tint);
    touch-action: none;
    cursor: crosshair;
  }
  /* The area's hairline, over its gradient, so its white corner reads on a
     white menu. */
  ${PICKER} [data-slot="area"]::after {
    content: "";
    position: absolute;
    inset: 0;
    border-radius: var(--color-picker-radius);
    box-shadow: inset 0 0 0 var(--hairline) var(--edge);
    pointer-events: none;
  }
  ${PICKER} [data-slot="area"]:focus-visible {
    outline: var(--ring) solid var(--ring-color);
    outline-offset: var(--ring);
  }
  ${PICKER} [data-slot="area-thumb"] {
    position: absolute;
    margin: calc(var(--slider-track) / -2) 0 0 calc(var(--slider-track) / -2);
    pointer-events: none;${LENS}
  }
  ${PICKER} [data-slot="hex-row"] {
    display: flex;
    gap: var(--space-2);
  }
  ${PICKER} [data-slot="preview"] {
    flex: none;
    box-sizing: border-box;
    inline-size: var(--control-sm);
    border: var(--rule);
    border-radius: var(--color-picker-radius);
    background: var(--color-picker-current);
  }
  ${PICKER} [data-slot="hex"] {
    flex: 1 1 auto;
    box-sizing: border-box;
    inline-size: 0;
    min-inline-size: 0;
    block-size: var(--control-sm);
    margin: 0;
    padding: 0 var(--space-2);
    border: var(--rule);
    border-radius: var(--color-picker-radius);
    background: var(--ground-sunken);
    color: var(--text-1);
    font-family: var(--font-mono);
    font-size: var(--fs-detail);
  }
  ${PICKER} [data-slot="hex"]:focus-visible {
    border-color: var(--edge-strong);
    outline: var(--ring) solid var(--ring-color);
    outline-offset: 0;
  }
  ${PICKER} [data-slot="hex"][aria-invalid="true"] {
    border-color: var(--danger);
    color: var(--danger);
  }

  ${SLIDER} {
    display: grid;
    gap: var(--space-2);
  }
  ${SLIDER} > label {
    display: flex;
    justify-content: space-between;
    gap: var(--space-2);
    color: var(--text-2);
    font-size: var(--fs-detail);
  }
  ${SLIDER} > label > [data-slot="value"] {
    color: var(--text-1);
    font-family: var(--font-mono);
    font-variant-numeric: tabular-nums;
  }
  ${SLIDERS} {
    appearance: none;
    box-sizing: border-box;
    display: block;
    justify-self: stretch;
    /* A host sets these on itself rather than out-ranking this rule. */
    inline-size: var(--slider-inline, auto);
    block-size: var(--slider-track);
    margin: 0;
    margin-inline-end: var(--slider-gap-end, 0);
    border-radius: var(--color-picker-radius, var(--radius-1));
    background: transparent;
    cursor: pointer;
  }
  ${SLIDERS}:focus-visible {
    outline: var(--ring) solid var(--ring-color);
    outline-offset: var(--ring);
  }
${pickerTrack('::-webkit-slider-runnable-track')}
${pickerTrack('::-moz-range-track')}
${pickerThumb('::-webkit-slider-thumb', `
    appearance: none;`)}
${pickerThumb('::-moz-range-thumb')}
`;

// --- Tabs (see tabs.ts) ---
// A row of tabs on a line: a neutral line under every tab (no accent, so only
// the selected tab is coloured), as heavy as the selected underline, and the
// selected tab in the full ink with the accent line over it. Both lines are a
// background of the underline's height at the bottom of their box, so the two
// coincide exactly and read as one line that lights under the selected tab. In
// a TopBar the bar draws the neutral line, across its whole width.
const TABS_CSS = `
  /* Too many tabs to fit: the row scrolls sideways with no scrollbar, and fades
     out at a side with more beyond it (TabList keeps data-more-left/right). */
  [data-boogy="tab-list"] {
    --_more-left: 0px;
    --_more-right: 0px;
    position: relative;
    display: flex;
    gap: 0;
    min-inline-size: 0;
    overflow-x: auto;
    overflow-y: hidden;
    overscroll-behavior-x: contain;
    scrollbar-width: none;
  }
  [data-boogy="tab-list"]::-webkit-scrollbar { display: none; }
  [data-boogy="tab-list"][data-dragging],
  [data-boogy="tab-list"][data-dragging] > [data-slot="tab"] { cursor: grabbing; user-select: none; }
  [data-boogy="tab-list"][data-more-left] { --_more-left: var(--tab-fade); }
  [data-boogy="tab-list"][data-more-right] { --_more-right: var(--tab-fade); }
  [data-boogy="tab-list"]:is([data-more-left], [data-more-right]) {
    mask-image: linear-gradient(to right, transparent, #000 var(--_more-left), #000 calc(100% - var(--_more-right)), transparent);
  }
  [data-boogy="tab-list"],
  [data-boogy="tab-list"] > [data-slot="tab"],
  [data-boogy="top-bar"]:has(> [data-slot="heading"] > [data-boogy="tab-list"]) {
    background-position: bottom;
    background-size: 100% var(--underline);
    background-repeat: no-repeat;
  }
  [data-boogy="tab-list"],
  [data-boogy="top-bar"]:has(> [data-slot="heading"] > [data-boogy="tab-list"]) {
    background-image: linear-gradient(var(--edge-strong), var(--edge-strong));
  }
  [data-boogy="top-bar"] > [data-slot="heading"] > [data-boogy="tab-list"] { background-image: none; }
  [data-boogy="tab-list"] > [data-slot="tab"] {
    position: relative;
    flex: none;
    white-space: nowrap;
    padding: var(--space-2);
    border: none;
    border-bottom: var(--underline) solid transparent;
    background-color: transparent;
    background-origin: border-box;
    color: var(--text-2);
    font: inherit;
    cursor: pointer;
  }
  [data-boogy="tab-list"] > [data-slot="tab"]:hover { color: var(--text-1); }
  /* A tab's own control (TabItem's action), right after it: one piece with
     its tab, on the same line (the selected tab's lights under both), its
     label's padding between them given up. */
  [data-boogy="tab-list"] > [data-slot="tab-action"] {
    flex: none;
    display: flex;
    align-items: center;
    padding-inline-end: var(--space-1);
    border-bottom: var(--underline) solid transparent;
    background-position: bottom;
    background-size: 100% var(--underline);
    background-repeat: no-repeat;
    background-origin: border-box;
  }
  [data-boogy="tab-list"] > [data-slot="tab"]:has(+ [data-slot="tab-action"]) { padding-inline-end: 0; }
  [data-boogy="tab-list"] > [data-slot="tab-action"][data-selected] { background-image: linear-gradient(var(--accent), var(--accent)); }
  [data-boogy="tab-list"][data-paged] > [data-slot="tab-action"][data-selected] { background-image: none; }
  [data-boogy="tab-list"][data-edge="top"] > [data-slot="tab-action"] {
    border-bottom: none;
    border-top: var(--underline) solid transparent;
    background-position: top;
  }
  /* A faint divider between neighbouring tabs, short of the row's top and
     bottom. The tabs sit edge to edge (no gap), so it is exactly between two;
     each tab's padding spaces the labels. */
  [data-boogy="tab-list"] > :is([data-slot="tab"], [data-slot="tab-action"]) + [data-slot="tab"]::before {
    content: "";
    position: absolute;
    inset-block: var(--space-2);
    inset-inline-start: 0;
    border-inline-start: 1px solid var(--edge);
  }
  /* A tab with a glyph: the glyph and its label on one line, centred, a gap
     apart; the glyph at the icon size (a 1em icon takes it from here), in the
     tab's colour, so it brightens with the label when selected. */
  [data-boogy="tab-list"] > [data-slot="tab"]:has(> [data-slot="icon"]) {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-2);
  }
  [data-boogy="tab-list"] > [data-slot="tab"] > [data-slot="icon"] { display: flex; flex: none; font-size: var(--icon-md); }
  /* fill: every tab an equal share of the row, its label centred in it */
  [data-boogy="tab-list"][data-fill="true"] > [data-slot="tab"] { flex: 1 1 0; min-inline-size: max-content; }
  [data-boogy="tab-list"] > [data-slot="tab"][aria-selected="true"] {
    color: var(--text-1);
    background-image: linear-gradient(var(--accent), var(--accent));
  }
  [data-boogy="tab-list"] > [data-slot="tab"]:focus-visible {
    outline: var(--ring) solid var(--ring-color);
    outline-offset: -1px;
  }
  /* Over a pager, one underline slides with the swipe (TabList places it)
     instead of the selected tab's own. */
  [data-boogy="tab-list"] > [data-slot="indicator"] { display: none; }
  [data-boogy="tab-list"][data-paged] > [data-slot="indicator"] {
    display: block;
    position: absolute;
    left: 0;
    bottom: 0;
    block-size: var(--underline);
    background: var(--accent);
    pointer-events: none;
  }
  [data-boogy="tab-list"][data-paged] > [data-slot="tab"][aria-selected="true"] { background-image: none; }
  /* A row below what it controls (edge: top): its lines run along its top
     edge, the side that meets its panel, and so does a bar's it heads. */
  [data-boogy="tab-list"][data-edge="top"],
  [data-boogy="tab-list"][data-edge="top"] > [data-slot="tab"],
  [data-boogy="top-bar"]:has(> [data-slot="heading"] > [data-boogy="tab-list"][data-edge="top"]) { background-position: top; }
  [data-boogy="tab-list"][data-edge="top"] > [data-slot="tab"] {
    border-bottom: none;
    border-top: var(--underline) solid transparent;
  }
  [data-boogy="tab-list"][data-edge="top"][data-paged] > [data-slot="indicator"] { bottom: auto; top: 0; }
  [data-boogy="tab-panel"] { outline: none; }
  /* A tab row as a TopBar's heading (its \`tabs\`) fills the bar's height, so the
     selected tab's line is the bar's bottom edge. */
  [data-boogy="top-bar"] > [data-slot="heading"]:has(> [data-boogy="tab-list"]) { align-self: stretch; grid-template-columns: minmax(0, 1fr); }
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

// --- Panel (see panel.ts) ---
// A framed region: its head and foot stay put and only its body scrolls, up
// and down, never sideways. Frosted, so a board shows through it, blurred.
// The body pads by a list item's inset, so its rows line up with the head;
// anything else in it is inset to a list item's text.
const PANEL_CSS = `
  [data-boogy="panel"] {
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    min-block-size: 0;
    min-inline-size: 0;
    overflow: hidden;
    border: var(--hairline) solid var(--edge);
    border-radius: var(--radius-2);
    background: color-mix(in oklch, var(--panel-ground, var(--ground-raised)) var(--panel-frost), transparent);
    backdrop-filter: blur(var(--blur-md));
  }
  [data-boogy="panel"][data-grow="true"] { flex: 1 1 auto; }
  [data-boogy="panel"] > :is([data-slot="head"], [data-slot="foot"]) {
    flex: none;
    display: grid;
    gap: var(--space-3);
    padding: var(--space-3) var(--space-4);
  }
  [data-boogy="panel"] > [data-slot="head"] { border-block-end: var(--hairline) solid var(--edge-faint); }
  [data-boogy="panel"] > [data-slot="foot"] { border-block-start: var(--hairline) solid var(--edge-faint); }
  [data-boogy="panel"] > [data-slot="body"] {
    flex: 1 1 auto;
    min-block-size: 0;
    overflow-y: auto;
    overflow-x: hidden;
    overscroll-behavior: contain;
    padding: var(--space-2);
  }
  [data-boogy="panel"] > [data-slot="body"] > :not([data-boogy="list"], [data-boogy="paged-list-end"]) { margin-inline: var(--space-2); }
`;

// --- SplitView (see split-view.ts) ---
// Narrow (the default): its tabs, then the selected region alone. Wide, at or
// above its breakpoint by its OWN width: no tabs, every region side by side,
// an aside at its own width. It fills the height it is given.
const SPLIT_VIEW_WIDE = (at: string) => `
  @container boogy-split (min-width: ${DRAWER_BREAKPOINTS[at as keyof typeof DRAWER_BREAKPOINTS]}) {
    [data-boogy="split-view"][data-collapse-at="${at}"] > [data-slot="tabs"] { display: none; }
    [data-boogy="split-view"][data-collapse-at="${at}"] > [data-slot="regions"] > [data-slot="region"] { display: flex; }
    [data-boogy="split-view"][data-collapse-at="${at}"] > [data-slot="regions"] > [data-slot="region"][data-aside] { flex: none; inline-size: var(--aside-width); }
    [data-boogy="split-view"][data-collapse-at="${at}"] > [data-slot="regions"] { padding-block-start: 0; }
  }
`;
const SPLIT_VIEW_CSS = `
  [data-boogy="split-view"] {
    container: boogy-split / inline-size;
    display: flex;
    flex-direction: column;
    flex: 1 1 auto;
    min-block-size: 0;
    min-inline-size: 0;
  }
  [data-boogy="split-view"] > [data-slot="tabs"] { flex: none; padding-inline: var(--space-4); }
  [data-boogy="split-view"] > [data-slot="regions"] {
    flex: 1 1 auto;
    min-block-size: 0;
    display: flex;
    gap: var(--space-4);
    padding: var(--space-3) var(--space-4) var(--space-4);
  }
  [data-boogy="split-view"] > [data-slot="regions"] > [data-slot="region"] {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
    flex: 1 1 0;
    min-inline-size: 0;
    min-block-size: 0;
  }
  [data-boogy="split-view"] > [data-slot="regions"] > [data-slot="region"]:not([data-selected]) { display: none; }
  ${Object.keys(DRAWER_BREAKPOINTS).map(SPLIT_VIEW_WIDE).join('')}
`;

// --- SearchSelect (see search-select.ts) ---
// Its trigger is a field's control: the choice, cut short with an ellipsis,
// then a chevron at the end. Open, its search stays at the top and only its
// results scroll, up to --select-height (the whole page, where the popover is
// a page). The results are a menu's rows; the one the arrow keys are on is lit
// as a focused menu row is. Its sections pad themselves, as anything in a
// popover does.
const SEARCH_SELECT_CSS = `
  [data-boogy="field"] > button[data-slot="control"] {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    inline-size: 100%;
    text-align: start;
    cursor: pointer;
  }
  [data-boogy="field"] > button[data-slot="control"] > [data-slot="value"] {
    flex: 1 1 auto;
    min-inline-size: 0;
    display: flex;
    align-items: center;
    gap: var(--space-1);
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }
  [data-boogy="field"] > button[data-slot="control"] > [data-slot="chevron"] { flex: none; margin-inline-start: auto; color: var(--text-3); }
  [data-boogy="search-select"] {
    display: flex;
    flex-direction: column;
    min-inline-size: max(var(--trigger-width, 0px), var(--menu-min-width, 0px));
    max-block-size: var(--select-height);
  }
  [data-boogy="popover"][data-mode="page"] [data-boogy="search-select"] { max-block-size: none; block-size: 100%; }
  [data-boogy="search-select"] > [data-slot="search"] {
    flex: none;
    padding: var(--space-3);
    border-block-end: var(--rule);
  }
  [data-boogy="search-select"] > [data-slot="results"] {
    flex: 1 1 auto;
    min-block-size: 0;
    overflow-y: auto;
    overscroll-behavior: contain;
  }
  [data-boogy="search-select"] [role="option"][data-active="true"] { background: var(--fill-hover); }
  [data-boogy="search-select"] [role="option"] > [data-slot="label"] { display: flex; align-items: center; gap: var(--space-1); }
  [data-boogy="search-select"] > [data-slot="results"] > [data-slot="empty"] {
    margin: 0;
    padding: var(--space-3);
    color: var(--text-3);
    font-size: var(--fs-detail);
  }
`;

// --- CodeBlock and FencedText (see code-block.ts) ---
// A well of code under its language's name and Copy. Only the code scrolls
// sideways, never the page. Collapsed, it is as tall as its first lines, the
// last faded under its footer. Its colours are highlight.js's classes, scoped
// here, each derived from the accent: its lightness (so it reads on either
// scheme), a fixed turn of its hue, and at least a floor of colour, so a grey
// accent (a grey board) still gives colours, each its own; mixed toward the
// ink. A board's accent recolours them all; comments are the quiet ink. A grid of one minmax(0, 1fr) column, so a line too long
// to fit adds nothing to the block's narrowest width: whatever holds it (a
// bubble) is never pushed wider, and the code scrolls inside instead.
const CODE_TURNS = { keyword: 0, string: 130, number: 60, title: 250, type: 190, attr: 310 } as const;
const CODE_COLOURS = (colour: (turn: number) => string) =>
  Object.entries(CODE_TURNS).map(([name, turn]) => `--code-${name}: ${colour(turn)};`).join('\n    ');
const CODE_HUE = (turn: number) => `color-mix(in oklch, oklch(from var(--accent) l max(c, 0.14) calc(h + ${turn})) 78%, var(--text-1))`;
// Where the browser has no relative colours: fixed hues, mixed toward the ink.
const CODE_FIXED_HUE = (turn: number) => `color-mix(in oklch, oklch(0.7 0.14 ${(turn + 350) % 360}) 78%, var(--text-1))`;
const CODE_BLOCK_CSS = `
  [data-boogy="code-block"] {
    ${CODE_COLOURS(CODE_FIXED_HUE)}
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    box-sizing: border-box;
    margin: 0;
    min-inline-size: 0;
    max-inline-size: 100%;
    overflow: hidden;
    border: var(--hairline) solid var(--edge);
    border-radius: var(--radius-2);
    background: var(--code-ground, var(--fill-hover));
    white-space: normal;
  }
  [data-boogy="code-block"] > [data-slot="head"] {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-0) var(--space-1) var(--space-0) var(--space-3);
    border-block-end: var(--hairline) solid var(--edge-faint);
    color: var(--text-2);
    font-size: var(--fs-caption);
  }
  [data-boogy="code-block"] > [data-slot="head"] > [data-slot="language"] {
    min-inline-size: 0;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }
  [data-boogy="code-block"] > [data-slot="head"] > [data-boogy="button"] { flex: none; margin-inline-start: auto; }
  [data-boogy="code-block"] > [data-slot="code"] {
    /* Its lines are its content box: the collapse counts on it, whatever an
       app sets for box-sizing everywhere else. */
    box-sizing: content-box;
    margin: 0;
    padding: var(--space-2) var(--space-3);
    overflow-x: auto;
    white-space: pre;
    tab-size: 4;
    color: var(--text-1);
    font-family: var(--font-mono);
    font-size: var(--fs-detail);
    line-height: 1.5;
    /* The characters as written: no => drawn as one arrow. */
    font-variant-ligatures: none;
  }
  /* The browser's own monospace for <code> has other metrics: its lines would
     not be the block's line height, and a collapse would cut one short. */
  [data-boogy="code-block"] > [data-slot="code"] > code { font: inherit; }
  [data-boogy="code-block"][data-collapsed="true"] > [data-slot="code"] {
    max-block-size: calc(var(--code-lines) * 1lh);
    overflow-y: hidden;
    -webkit-mask-image: linear-gradient(to bottom, black calc(100% - 2lh), transparent);
    mask-image: linear-gradient(to bottom, black calc(100% - 2lh), transparent);
  }
  /* A markdown block: its tabs in the head, its preview the body. */
  [data-boogy="code-block"] > [data-slot="head"] > [data-boogy="tab-list"] { flex: 0 1 auto; min-inline-size: 0; }
  [data-boogy="code-block"] > [data-slot="head"] > [data-boogy="tab-list"] > [data-slot="tab"] { padding-block: var(--space-1); }
  [data-boogy="code-block"] > [data-slot="preview"] {
    min-inline-size: 0;
    padding: var(--space-2) var(--space-3);
    line-height: 1.5;
  }
  [data-boogy="code-block"][data-collapsed="true"] > [data-slot="preview"] {
    max-block-size: calc(var(--code-lines) * 1lh);
    overflow: hidden;
    -webkit-mask-image: linear-gradient(to bottom, black calc(100% - 2lh), transparent);
    mask-image: linear-gradient(to bottom, black calc(100% - 2lh), transparent);
  }
  /* The view not shown: laid out for its width, at no height, unseen. After
     both views' own rules, so its no-padding wins. */
  [data-boogy="code-block"] > [data-inactive] { block-size: 0; padding-block: 0; overflow: hidden; visibility: hidden; }
  [data-boogy="code-block"] > [data-slot="foot"] {
    display: flex;
    justify-content: center;
    border-block-start: var(--hairline) solid var(--edge-faint);
  }
  :is([data-boogy="code-block"], [data-boogy="markdown"]) :is(.hljs-keyword, .hljs-selector-tag, .hljs-literal, .hljs-doctag) { color: var(--code-keyword); }
  :is([data-boogy="code-block"], [data-boogy="markdown"]) :is(.hljs-string, .hljs-regexp, .hljs-addition, .hljs-template-tag) { color: var(--code-string); }
  :is([data-boogy="code-block"], [data-boogy="markdown"]) :is(.hljs-number, .hljs-symbol, .hljs-bullet, .hljs-link) { color: var(--code-number); }
  :is([data-boogy="code-block"], [data-boogy="markdown"]) :is(.hljs-title, .hljs-section, .hljs-name, .hljs-selector-id, .hljs-selector-class) { color: var(--code-title); }
  :is([data-boogy="code-block"], [data-boogy="markdown"]) :is(.hljs-type, .hljs-built_in, .hljs-title.class_) { color: var(--code-type); }
  :is([data-boogy="code-block"], [data-boogy="markdown"]) :is(.hljs-attr, .hljs-attribute, .hljs-property, .hljs-variable, .hljs-template-variable, .hljs-params, .hljs-meta, .hljs-tag) { color: var(--code-attr); }
  :is([data-boogy="code-block"], [data-boogy="markdown"]) :is(.hljs-comment, .hljs-quote) { color: var(--text-3); font-style: italic; }
  :is([data-boogy="code-block"], [data-boogy="markdown"]) .hljs-deletion { color: var(--danger); }
  :is([data-boogy="code-block"], [data-boogy="markdown"]) .hljs-emphasis { font-style: italic; }
  :is([data-boogy="code-block"], [data-boogy="markdown"]) .hljs-strong { font-weight: 600; }
  /* Markdown, rendered: prose. Its blocks a gap apart, a heading a little
     more above it; code and a wide table scroll sideways inside, never the
     page. A grid of one minmax(0, 1fr) column, so nothing in it (a wide
     table, a long line of code) widens what holds it, as a CodeBlock. */
  [data-boogy="markdown"] {
    ${CODE_COLOURS(CODE_FIXED_HUE)}
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    row-gap: var(--space-2);
    min-inline-size: 0;
    overflow-wrap: anywhere;
    line-height: 1.5;
  }
  [data-boogy="markdown"] > * { margin-block: 0; }
  [data-boogy="markdown"] > :is(h1, h2, h3, h4, h5, h6):not(:first-child) { margin-block-start: var(--space-2); }
  [data-boogy="markdown"] :is(li, blockquote) > :is(p, ul, ol, pre) { margin-block: var(--space-1); }
  [data-boogy="markdown"] :is(h1, h2, h3, h4, h5, h6) { line-height: 1.25; font-weight: 600; }
  [data-boogy="markdown"] h1 { font-size: var(--fs-title); }
  [data-boogy="markdown"] h2 { font-size: var(--fs-body); }
  [data-boogy="markdown"] :is(h3, h4, h5, h6) { font-size: var(--fs-detail); }
  [data-boogy="markdown"] :is(ul, ol) { padding-inline-start: var(--space-5); }
  [data-boogy="markdown"] li + li { margin-block-start: var(--space-1); }
  [data-boogy="markdown"] li:has(> input[type="checkbox"]) { list-style: none; margin-inline-start: calc(-1 * var(--space-4)); }
  [data-boogy="markdown"] input[type="checkbox"] { margin: 0 var(--space-1) 0 0; vertical-align: middle; accent-color: var(--accent); }
  [data-boogy="markdown"] blockquote { margin-inline: 0; padding-inline-start: var(--space-3); border-inline-start: var(--underline) solid var(--edge); color: var(--text-2); }
  [data-boogy="markdown"] a { color: var(--accent); text-decoration: underline; }
  [data-boogy="markdown"] :not(pre) > code {
    padding: 0 var(--space-1);
    border-radius: var(--radius-1);
    background: var(--fill-selected);
    font-family: var(--font-mono);
    font-size: var(--fs-detail);
  }
  [data-boogy="markdown"] pre {
    overflow-x: auto;
    padding: var(--space-2) var(--space-3);
    border-radius: var(--radius-2);
    background: var(--fill-hover);
    font-family: var(--font-mono);
    font-size: var(--fs-detail);
    line-height: 1.5;
    white-space: pre;
    font-variant-ligatures: none;
  }
  [data-boogy="markdown"] pre > code { font: inherit; }
  [data-boogy="markdown"] table { display: block; max-inline-size: 100%; overflow-x: auto; border-collapse: collapse; }
  [data-boogy="markdown"] :is(th, td) { padding: var(--space-1) var(--space-2); border: var(--hairline) solid var(--edge); text-align: start; }
  /* A heading never breaks mid-label: a table with more columns than fit
     scrolls, and long text in its cells still wraps. */
  [data-boogy="markdown"] th { font-weight: 600; background: var(--fill-hover); white-space: nowrap; }
  [data-boogy="markdown"] hr { border: none; border-block-start: var(--hairline) solid var(--edge); }
  [data-boogy="markdown"] img { max-inline-size: 100%; block-size: auto; }
  [data-boogy="markdown"] > [data-slot="plain"] { white-space: pre-wrap; }
  [data-boogy="fenced-text"] {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    min-inline-size: 0;
    max-inline-size: 100%;
  }
  [data-boogy="fenced-text"] > [data-slot="text"] { margin: 0; white-space: pre-wrap; overflow-wrap: anywhere; }
  /* Last, so it wins over the fixed hues where the browser has relative
     colours; a preview's code takes the same colours as a block's. */
  @supports (color: oklch(from red l c h)) {
    :is([data-boogy="code-block"], [data-boogy="markdown"]) {
    ${CODE_COLOURS(CODE_HUE)}
    }
  }
`;

// --- Form (see form.ts) ---
// A form for a screen: the fields scroll in the body, as wide as it is (they
// grow with the pane, as everything does); the foot is a sheet's foot (a rule
// above, the actions at the end) that never scrolls, so Save sits at the
// fields' edge. A failed submit's notice takes the foot's first line.
const FORM_CSS = `
  [data-boogy="form"] {
    display: flex;
    flex-direction: column;
    flex: 1 1 auto;
    min-block-size: 0;
    min-inline-size: 0;
    margin: 0;
  }
  [data-boogy="form"] > [data-slot="body"] {
    flex: 1 1 auto;
    min-block-size: 0;
    overflow: auto;
    padding: var(--space-4);
  }
  [data-boogy="form"] [data-slot="fields"] {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }
  [data-boogy="form"] > [data-slot="foot"] {
    flex: none;
    padding: var(--space-3) var(--space-4);
    border-top: var(--rule);
  }
  [data-boogy="form"] [data-slot="actions"] {
    display: flex;
    flex-wrap: wrap;
    justify-content: flex-end;
    align-items: center;
    gap: var(--space-2);
  }
  [data-boogy="form"] [data-slot="actions"] > [data-boogy="notice"] { flex: 1 1 100%; order: -2; }
`;

// --- Link preview (see link-preview.ts) ---
// A link in a message's text, and a linked page's card under it: a bar of the
// accent down its start, the site's name, the title (two lines at most) and the
// description (three), the image across it under the text (a wide one) or
// beside it (any other). The whole card is one link. A message's cards sit in
// a row where there is room for each at a card's least width, and wrap one
// under the other where there is not.
const LINK_PREVIEW_CSS = `
  [data-boogy="fenced-text"] > [data-slot="previews"] {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
    min-inline-size: 0;
  }
  [data-boogy="fenced-text"] > [data-slot="previews"] > [data-boogy="link-preview"] { flex: 1 1 var(--card-min); }
  [data-boogy="fenced-text"] [data-slot="link"] {
    color: var(--accent);
    text-decoration: underline;
    text-decoration-thickness: var(--hairline);
  }
  [data-boogy="fenced-text"] [data-slot="link"]:focus-visible { outline: var(--ring) solid var(--ring-color); }
  [data-boogy="link-preview"] {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: var(--space-2);
    box-sizing: border-box;
    min-inline-size: 0;
    max-inline-size: 100%;
    padding: var(--space-2) var(--space-3);
    border-inline-start: var(--space-1) solid var(--accent);
    border-radius: var(--radius-2);
    background: var(--fill-hover);
    color: inherit;
    text-decoration: none;
    white-space: normal;
  }
  [data-boogy="link-preview"]:hover { background: var(--fill-selected); }
  [data-boogy="link-preview"]:focus-visible { outline: var(--ring) solid var(--ring-color); outline-offset: var(--ring); }
  [data-boogy="link-preview"][data-layout="side"] { grid-template-columns: minmax(0, 1fr) auto; align-items: start; }
  [data-boogy="link-preview"] > [data-slot="body"] {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    min-inline-size: 0;
  }
  [data-boogy="link-preview"] [data-slot="site"] {
    overflow: hidden;
    font-size: var(--fs-caption);
    color: var(--text-3);
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  [data-boogy="link-preview"] :is([data-slot="title"], [data-slot="description"]) {
    display: -webkit-box;
    -webkit-box-orient: vertical;
    overflow: hidden;
    overflow-wrap: anywhere;
  }
  [data-boogy="link-preview"] [data-slot="title"] {
    -webkit-line-clamp: 2;
    font-weight: 600;
    color: var(--accent);
    line-height: 1.25;
  }
  [data-boogy="link-preview"] [data-slot="description"] {
    -webkit-line-clamp: 3;
    font-size: var(--fs-detail);
    color: var(--text-2);
  }
  [data-boogy="link-preview"] > [data-slot="image"] {
    display: block;
    border-radius: var(--radius-1);
    object-fit: cover;
  }
  [data-boogy="link-preview"][data-layout="wide"] > [data-slot="image"] {
    inline-size: 100%;
    max-block-size: var(--media-md);
  }
  [data-boogy="link-preview"][data-layout="side"] > [data-slot="image"] {
    inline-size: var(--thumb-lg);
    block-size: var(--thumb-lg);
  }
`;

// --- Count (see count.ts) ---
// A badge of its own beside a label: its own wash and a full radius, a gap
// before it, figures of one width so a changing count does not shift its
// neighbours. In a selected tab or a chosen segment it takes the accent.
const COUNT_CSS = `
  [data-boogy="count"] {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    box-sizing: border-box;
    min-inline-size: var(--count-block);
    block-size: var(--count-block);
    padding-inline: var(--space-1);
    margin-inline-start: var(--space-2);
    border-radius: var(--radius-full);
    background: var(--fill-selected);
    color: var(--text-2);
    font-size: var(--fs-micro);
    font-weight: 600;
    line-height: 1;
    font-variant-numeric: tabular-nums;
    vertical-align: middle;
  }
  :is([data-boogy="tab-list"] > [data-slot="tab"][aria-selected="true"], [data-boogy="choice-group"] [data-slot="choice"] > input:checked + [data-slot="choice-label"]) > [data-boogy="count"] {
    background: color-mix(in oklch, var(--accent) 28%, transparent);
    color: var(--text-1);
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
  [data-boogy="choice-group"] > [data-slot="choices"] { display: grid; gap: var(--space-2); }
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

  /* segmented: one track of segments. The radio stays in the page, focusable
     and keyboard-driven, but is not drawn; its label is the segment. Only the
     chosen segment is filled. The track is as wide as its labels, or with
     fill takes the width and shares it evenly. */
  [data-boogy="choice-group"][data-variant="segmented"] > [data-slot="choices"] {
    display: inline-flex;
    justify-self: start;
    gap: var(--space-0);
    padding: var(--space-0);
    max-inline-size: 100%;
    box-sizing: border-box;
    border: var(--hairline) solid var(--edge-faint);
    border-radius: var(--radius-2);
    background: var(--fill-hover);
  }
  [data-boogy="choice-group"][data-variant="segmented"][data-fill="true"] > [data-slot="choices"] { display: flex; justify-self: stretch; }
  [data-boogy="choice-group"][data-variant="segmented"] [data-slot="choice"] {
    position: relative;
    display: flex;
    flex: 1 1 0;
    min-inline-size: 0;
  }
  [data-boogy="choice-group"][data-variant="segmented"] [data-slot="choice"] > input {
    position: absolute;
    inset: 0;
    inline-size: 100%;
    block-size: 100%;
    margin: 0;
    opacity: 0;
    pointer-events: none;
  }
  [data-boogy="choice-group"][data-variant="segmented"] [data-slot="choice-label"] {
    flex: 1 1 auto;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-block-size: var(--control-sm);
    padding-inline: var(--space-3);
    border-radius: var(--radius-1);
    color: var(--text-2);
    font-size: var(--fs-detail);
    font-weight: 500;
    white-space: nowrap;
  }
  [data-boogy="choice-group"][data-variant="segmented"] [data-slot="choice-label"]:hover { color: var(--text-1); }
  [data-boogy="choice-group"][data-variant="segmented"] [data-slot="choice"] > input:checked + [data-slot="choice-label"] {
    background: var(--fill-strong);
    color: var(--text-1);
  }
  [data-boogy="choice-group"][data-variant="segmented"] [data-slot="choice"] > input:focus-visible + [data-slot="choice-label"] {
    outline: var(--ring) solid var(--ring-color);
    outline-offset: calc(-1 * var(--ring));
  }
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
// ConfirmAction (see confirm-action.ts): the question and its two answers
// where the action was, never past what holds it. Asking, the question wraps
// and the answers stay together, beside it while they fit and under it when
// they do not. In a list row it takes a line of its own under the row's text,
// which keeps its width, and the row's other actions step aside until it is
// answered.
const ASKING = '[data-boogy="confirm-action"][data-asking]';
const CONFIRM_ACTION_CSS = `
  [data-boogy="confirm-action"] { display: inline-flex; align-items: center; gap: var(--space-1); }
  ${ASKING} {
    display: flex;
    flex-wrap: wrap;
    justify-content: flex-end;
    column-gap: var(--space-2);
    row-gap: var(--space-1);
    min-inline-size: 0;
    max-inline-size: 100%;
  }
  [data-boogy="confirm-action"] > [data-slot="question"] {
    flex: 1 1 auto;
    min-inline-size: 0;
    color: var(--text-2);
    font-size: var(--fs-caption);
    overflow-wrap: anywhere;
  }
  [data-boogy="confirm-action"] > [data-slot="answers"] { display: inline-flex; flex: none; gap: var(--space-1); }
  [data-boogy="list-item"]:has(> [data-slot="end"] ${ASKING}) { flex-wrap: wrap; }
  [data-boogy="list-item"] > [data-slot="end"]:has(${ASKING}) {
    flex: 1 1 100%;
    min-inline-size: 0;
    display: flex;
    justify-content: flex-end;
  }
  [data-boogy="list-item"] > [data-slot="end"]:has(${ASKING}) [data-boogy="button"]:not(${ASKING} *) { display: none; }
`;

// PagedListEnd (see paged-list-end.ts): its button centred under the list.
const PAGED_LIST_END_CSS = `
  [data-boogy="paged-list-end"] { display: flex; justify-content: center; padding-block: var(--space-2); }
`;

// NumericValue (see numeric-value.ts): its digits at one width, so a count
// that changes does not jitter what is beside it.
const NUMERIC_VALUE_CSS = `
  [data-boogy="numeric-value"] { font-variant-numeric: tabular-nums; }
`;

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
    /* One height wherever it is: on its own, as a sheet's head (which then
       adds none of its own), with tabs. */
    min-block-size: var(--top-bar-block);
    min-inline-size: 0;
  }
  /* \`shadow\`: a shadow below it, over what scrolls under it (its stacking
     lifts it above the content that follows it). */
  [data-boogy="top-bar"][data-shadow] { z-index: 1; box-shadow: var(--bar-shadow); }
  /* A bar with a row below it (\`below\`): the two one unit, a column, its
     shadow below the row rather than between them; the row takes the bar's
     width (a row of tabs fills it). */
  [data-boogy="top-bar-stack"] { position: relative; display: flex; flex-direction: column; min-inline-size: 0; }
  [data-boogy="top-bar-stack"][data-shadow] { z-index: 1; box-shadow: var(--bar-shadow); }
  /* A rule under the bar itself, between it and the row: the line a sheet's
     head draws under its bar. */
  [data-boogy="top-bar-stack"] > [data-boogy="top-bar"] { border-bottom: var(--rule); }
  [data-boogy="top-bar-stack"] > [data-slot="below"] { display: flex; min-inline-size: 0; }
  [data-boogy="top-bar-stack"] > [data-slot="below"] > * { flex: 1 1 auto; min-inline-size: 0; }
  [data-boogy="top-bar"] > [data-slot="leading"] { display: flex; flex: none; align-items: center; }
  /* A mark beside the title and its subtitle (a logo). */
  [data-boogy="top-bar"] > [data-slot="media"] { display: flex; flex: none; align-items: center; }
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
  /* A title may carry media beside its text (an avatar by a name), as a
     Sheet's may. */
${titleWithMedia('[data-boogy="top-bar"] > [data-slot="heading"] > [data-slot="title"]', 'var(--space-2)')}
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
  /* An item that asks for attention carries a small dot in the accent on its
     button; More carries it while such an item is in its menu, and the row
     carries it after its label. */
  [data-boogy="top-bar"] [data-boogy="button"][data-attention] { position: relative; }
  [data-boogy="top-bar"] [data-boogy="button"][data-attention]::after {
    content: '';
    position: absolute;
    inset-block-start: var(--space-1);
    inset-inline-end: var(--space-1);
    inline-size: var(--space-2);
    block-size: var(--space-2);
    border-radius: 50%;
    background: var(--accent);
    pointer-events: none;
  }
  [data-boogy="menu"] > [data-slot="row"][data-attention] > [data-slot="label"]::after {
    content: '';
    display: inline-block;
    inline-size: var(--space-2);
    block-size: var(--space-2);
    margin-inline-start: var(--space-2);
    border-radius: 50%;
    background: var(--accent);
  }
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
  /* The gap before the label is an item's icon column gap, so every row's label starts at one inline position. */
  [data-boogy="menu-row"] { display: flex; align-items: center; justify-content: space-between; gap: var(--space-3); }
  [data-boogy="menu-row"] > [data-slot="label"] { flex: 1; min-width: 0; }
  [data-boogy="menu-row"]:focus-within { background: var(--fill-hover); }
  [data-boogy="menu-row"] > [data-slot="widget"] { display: flex; align-items: center; }
  /* A faint hairline between each two of the menu's rows, none above the
     first: drawn in the hairline gap between them, so a row's fill never
     covers it, its rounded corners never bend it, and every row keeps its
     padding. */
  [data-boogy="menu"] > [data-slot="row"] { position: relative; }
  [data-boogy="menu"] > [data-slot="row"] ~ [data-slot="row"]::before {
    content: '';
    position: absolute;
    inset-inline: 0;
    inset-block-start: calc(-1 * var(--hairline));
    block-size: var(--hairline);
    background: var(--edge-faint);
    pointer-events: none;
  }
`;

// --- TabPager (see tab-pager.ts) ---
// One row of pages, each the pager's full size, placed by its index
// (`grid-column`, set by tabPage()), so no page moves when others come and go.
// The swipe is native scrolling that snaps to a page, one page per fling; at
// either end it stays in the pager rather than becoming the browser's back.
const TAB_PAGER_CSS = `
  [data-boogy="tab-pager"] {
    display: grid;
    grid-template-rows: 100%;
    grid-auto-columns: 100%;
    overflow-x: auto;
    overflow-y: hidden;
    scroll-snap-type: x mandatory;
    overscroll-behavior-x: contain;
    scrollbar-width: none;
  }
  [data-boogy="tab-pager"]::-webkit-scrollbar { display: none; }
  [data-boogy="tab-pager"] > [data-slot="page"] {
    grid-row: 1;
    min-inline-size: 0;
    min-block-size: 0;
    scroll-snap-align: start;
    scroll-snap-stop: always;
  }
`;

// SidePanel (see side-panel.ts): in the top layer, as a popover is. The element
// is the window behind the panel, clear unless it has a scrim; the panel is
// docked to the inline-end edge and slides in from it, and fills the window
// when `full`. Its Sheet fills the panel rather than the window, on the
// opaque solid ground so the page does not show through it.
const SIDE_PANEL_CSS = `
  [data-boogy="side-panel"] {
    --side-panel-width: calc(var(--u) * 25);
    box-sizing: border-box;
    position: fixed;
    inset: 0;
    inline-size: auto;
    block-size: auto;
    max-inline-size: none;
    max-block-size: none;
    margin: 0;
    padding: 0;
    border: 0;
    overflow: hidden;
    background: transparent;
  }
  [data-boogy="side-panel"]::backdrop { background: transparent; }
  [data-boogy="side-panel"][data-scrim] { background: color-mix(in oklch, black 45%, transparent); }
  [data-boogy="side-panel"] > [data-slot="panel"] {
    box-sizing: border-box;
    position: absolute;
    inset-block: 0;
    inset-inline-end: 0;
    inline-size: min(100%, var(--side-panel-width));
    box-shadow: var(--overlay-shadow);
    transition: translate var(--dur-base) ease-out;
  }
  @starting-style {
    [data-boogy="side-panel"] > [data-slot="panel"] { translate: 100% 0; }
    [dir="rtl"] [data-boogy="side-panel"] > [data-slot="panel"] { translate: -100% 0; }
  }
  [data-boogy="side-panel"][data-full] > [data-slot="panel"] { inline-size: 100%; box-shadow: none; }
  /* bordered: a line on the edge facing the page, in the app's colour for it
     if it sets one; a panel filling the window faces no page. */
  [data-boogy="side-panel"][data-bordered]:not([data-full]) > [data-slot="panel"] {
    border-inline-start: 1px solid var(--side-panel-edge, var(--edge-strong));
  }
  [data-boogy="side-panel"] > [data-slot="panel"] > [data-boogy="sheet"] {
    position: absolute;
    inset: 0;
    background: var(--sheet-ground, var(--ground-solid));
  }
  /* Its contents, once it has slid in (data-ready), fade in. */
  [data-boogy="side-panel"][data-ready] > [data-slot="panel"] > [data-boogy="sheet"] > [data-slot="body"] {
    animation: boogy-side-panel-reveal var(--dur-base) ease-out;
  }
  @keyframes boogy-side-panel-reveal { from { opacity: 0; } }
  [data-boogy="side-panel"] > [data-slot="panel"]:focus { outline: none; }
  @media (prefers-reduced-motion: reduce) {
    [data-boogy="side-panel"] > [data-slot="panel"] { transition: none; }
    [data-boogy="side-panel"][data-ready] > [data-slot="panel"] > [data-boogy="sheet"] > [data-slot="body"] { animation: none; }
  }
`;

// Divider (see divider.ts): a hairline in the edge colour. Vertical, it
// stands the height of the bar it divides, a small space either side of it;
// horizontal, it runs the width of its column.
const DIVIDER_CSS = `
  [data-boogy="divider"] {
    flex: none;
    background: var(--edge);
  }
  [data-boogy="divider"][aria-orientation="vertical"] {
    inline-size: 1px;
    align-self: stretch;
    margin-inline: var(--space-1);
  }
  [data-boogy="divider"][aria-orientation="horizontal"] {
    block-size: 1px;
    margin-block: var(--space-1);
  }
`;

export const COMPONENTS_CSS_PARTS = { PILL_CSS, BUTTON_CSS, BUTTON_GROUP_CSS, DRAWER_CSS, POPOVER_CSS, MENU_CSS, SHEET_CSS, SIDE_PANEL_CSS, DIVIDER_CSS, EMPTY_STATE_CSS, FIELD_CSS, AVATAR_CSS, SEEDED_ART_CSS, BUBBLE_CSS, INLINE_EDIT_CSS, SWATCH_CSS, COLOR_PICKER_CSS, TABS_CSS, TAB_PAGER_CSS, SECTION_CSS, THUMBNAIL_CSS, TILE_CSS, LIST_CSS, NOTICE_CSS, INFO_LIST_CSS, DETAIL_HEADER_CSS, STACK_CSS, CARD_CSS, CAROUSEL_CSS, FIT_TEXT_CSS, FILL_GRID_CSS, SEGMENT_CSS, METER_CSS, SWITCH_CSS, PANEL_CSS, SPLIT_VIEW_CSS, SEARCH_SELECT_CSS, CODE_BLOCK_CSS, LINK_PREVIEW_CSS, FORM_CSS, COUNT_CSS, CHOICE_GROUP_CSS, VISUALLY_HIDDEN_CSS, DATA_TABLE_CSS, STAT_CSS, NUMERIC_VALUE_CSS, CONFIRM_ACTION_CSS, PAGED_LIST_END_CSS, COLUMN_CHART_CSS, TOP_BAR_CSS };

export const COMPONENTS_CSS = `${FILL_GRID_PROPERTIES}
@layer boogy.components {
${PILL_CSS}
${BUTTON_CSS}
${BUTTON_GROUP_CSS}
${DRAWER_CSS}
${POPOVER_CSS}
${MENU_CSS}
${SHEET_CSS}
${SIDE_PANEL_CSS}
${DIVIDER_CSS}
${EMPTY_STATE_CSS}
${FIELD_CSS}
${AVATAR_CSS}
${SEEDED_ART_CSS}
${BUBBLE_CSS}
${INLINE_EDIT_CSS}
${SWATCH_CSS}
${COLOR_PICKER_CSS}
${TABS_CSS}
${TAB_PAGER_CSS}
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
${PANEL_CSS}
${SPLIT_VIEW_CSS}
${SEARCH_SELECT_CSS}
${CODE_BLOCK_CSS}
${LINK_PREVIEW_CSS}
${FORM_CSS}
${COUNT_CSS}
${CHOICE_GROUP_CSS}
${VISUALLY_HIDDEN_CSS}
${DATA_TABLE_CSS}
${STAT_CSS}
${NUMERIC_VALUE_CSS}
${CONFIRM_ACTION_CSS}
${PAGED_LIST_END_CSS}
${COLUMN_CHART_CSS}
${TOP_BAR_CSS}
}
`;
