// The foundation stylesheet, as a string so it ships inside the module and
// installs through a constructable stylesheet: one delivery path whether the
// SDK is served by the platform or bundled by the app.
//
// `--u`, `--u-inline` and `--u-block` are REGISTERED lengths. That is
// load-bearing: an unregistered custom property carries unresolved text, so a
// container unit inside it would be resolved at every USE site against that
// element's own nearest container. Registered, it computes once, where it is
// declared, and descendants inherit the number.
//
// The size tokens (`--fs-*`, `--space-*`, `--radius-*`) are expressions over
// `var(--u)`, and a `var()` inside a custom property is resolved where the
// property is DECLARED, then inherited as the resolved value. Declared only on
// `:root` they would freeze at the root's `--u`. So they are declared on
// `:root` AND on every element that sets its own `--u` (`[data-u-policy]`):
// each scaled region re-derives them from its own unit, and its descendants
// inherit that. An app token defined the same way must use the same selector.
//
// Never `sqrt(pow(...))`: it is unsupported in current engines and the
// declaration is silently dropped. `hypot()` is the supported spelling.

export const FOUNDATION_CSS = `
@property --u { syntax: '<length>'; inherits: true; initial-value: 16px; }
@property --u-inline { syntax: '<length>'; inherits: true; initial-value: 16px; }
@property --u-block { syntax: '<length>'; inherits: true; initial-value: 16px; }
@property --u-zoom { syntax: '<number>'; inherits: true; initial-value: 1; }

@layer boogy.foundation {
  :root {
    --u-base: 1rem;
    /* The interface zoom: a multiplier on the unit. The zoom store sets it on
       <html>; it is 1 until a person (or a board framing the page) changes it.
       Declared here too, so a page with no scale still follows it — from the
       unit's own 16px, NOT from rem: an app may size its root font from the
       unit (html { font: var(--fs-body) … }), and a root unit derived from the
       root's font would be a cycle, which a browser resolves by dropping the
       tokens (Firefox does, per spec). */
    --u: calc(16px * var(--u-zoom));
    --u-inline: calc(16px * var(--u-zoom));
    --u-block: calc(16px * var(--u-zoom));

    /* knobs */
    --hue: 250;
    --tint: 0.012;
    --accent: oklch(0.74 0.15 170);
    --contrast: 1;
    --scheme: light dark;
    color-scheme: var(--scheme);

    /* grounds: the base is pure WHITE in light and pure BLACK in dark, with no
       tint; the other grounds step from it the only way there is room to. In
       light a sunken field is a step below white and raised / overlay surfaces
       stay white (they cannot go above it); in dark a sunken field stays black
       (it cannot go below it) and raised / overlay surfaces rise a step and two
       above it. Edges and shadows, not a ground step, set a white surface on a
       white page apart.
       The base ground is translucent, so whatever a page sits on (a frame's
       host, a backdrop) shows through it: 85% opaque in light, 40% in dark
       (black at 85% over a dark backdrop leaves almost none of its colour,
       while white lower than 85% would muddy the ground behind dark text).
       --ground-solid is the same colour fully opaque, for surfaces that
       cover content (a full-page popover). */
    --_step: calc(0.035 * var(--contrast));
    --ground-solid: light-dark(oklch(1 0 0), oklch(0 0 0));
    --ground: light-dark(oklch(1 0 0 / 0.85), oklch(0 0 0 / 0.4));
    --ground-sunken: light-dark(oklch(calc(1 - var(--_step)) 0 0), oklch(0 0 0));
    --ground-raised: light-dark(oklch(1 0 0), oklch(var(--_step) 0 0));
    --ground-overlay: light-dark(oklch(1 0 0), oklch(calc(2 * var(--_step)) 0 0));
    /* The well: a translucent SUNKEN ground — a darker band over a page (a
       message bar, a footer) that still shows what is behind. A step below
       white at the page's 85% in light; black at 60% in dark, over a page that
       is black at 40%. */
    --ground-well: light-dark(oklch(calc(1 - var(--_step)) 0 0 / 0.85), oklch(0 0 0 / 0.6));

    /* text */
    --text-1: light-dark(oklch(0.22 var(--tint) var(--hue)), oklch(0.93 var(--tint) var(--hue)));
    --text-2: light-dark(oklch(0.42 var(--tint) var(--hue)), oklch(0.72 var(--tint) var(--hue)));
    --text-3: light-dark(oklch(0.53 var(--tint) var(--hue)), oklch(0.58 var(--tint) var(--hue)));

    /* edges: a translucent share of the ink, so over an opaque ground they
       are close to an opaque mix of the two, and over a translucent one they
       read as a dim line in the colour showing through — never a near-black
       line across a page in dark */
    --edge: color-mix(in oklch, var(--text-1) 12%, transparent);
    --edge-strong: color-mix(in oklch, var(--text-1) 28%, transparent);
    --rule: 1px solid var(--edge);

    /* accent, derived */
    --accent-hover: oklch(from var(--accent) calc(l + 0.06) c h);
    --accent-soft: oklch(from var(--accent) l c h / 0.16);
    /* The focus ring. On a dark ground the full accent outshone the control it
       rings; at 0.6 it still stands over 3:1 against the dark grounds, the
       contrast a focus indicator needs. A light ground keeps the full accent,
       which is already nearer that floor. */
    --ring-color: light-dark(var(--accent), oklch(from var(--accent) l c h / 0.6));

    /* status: one lightness and chroma per scheme, hue varies */
    --ok: light-dark(oklch(0.55 0.14 150), oklch(0.74 0.14 150));
    --warn: light-dark(oklch(0.55 0.14 80), oklch(0.74 0.14 80));
    --danger: light-dark(oklch(0.55 0.16 25), oklch(0.74 0.16 25));
    --info: light-dark(oklch(0.55 0.12 240), oklch(0.74 0.12 240));

    /* fills */
    --fill-hover: color-mix(in oklch, var(--text-1) 6%, transparent);
    --fill-selected: color-mix(in oklch, var(--text-1) 12%, transparent);
    /* scrollbar thumb: faint at rest, a step up while its area is hovered */
    --scrollbar-thumb: color-mix(in oklch, var(--text-1) 14%, transparent);
    --scrollbar-thumb-hover: color-mix(in oklch, var(--text-1) 26%, transparent);

    /* shadows, by role (HeroUI v3's): a surface in the page, a floating
       overlay (popover, menu, off-canvas drawer), a form field. Light values
       are HeroUI's. In dark, surface and field drop theirs as HeroUI does, but
       an overlay keeps a deep one: on a dark ground a popup with no shadow at
       all loses its lift. Fixed px, like a hairline: depth does not scale. */
    --surface-shadow: 0 2px 4px 0 light-dark(rgb(0 0 0 / 0.04), transparent), 0 1px 2px 0 light-dark(rgb(0 0 0 / 0.06), transparent), 0 0 1px 0 light-dark(rgb(0 0 0 / 0.06), transparent);
    --overlay-shadow: 0 4px 16px 0 light-dark(rgb(24 24 27 / 0.08), rgb(0 0 0 / 0.45)), 0 8px 24px 0 light-dark(rgb(24 24 27 / 0.09), rgb(0 0 0 / 0.35));
    --field-shadow: 0 2px 4px 0 light-dark(rgb(0 0 0 / 0.04), transparent), 0 1px 2px 0 light-dark(rgb(0 0 0 / 0.06), transparent), 0 0 1px 0 light-dark(rgb(0 0 0 / 0.06), transparent);

    /* A finger does not scale with the unit. */
    --touch-min: 2.75rem;

    /* motion */
    --dur-fast: 80ms;
    --dur-base: 160ms;
    --dur-slow: 280ms;

    /* type */
    --font-body: "Figtree", system-ui, sans-serif;
    --font-mono: "JetBrains Mono", ui-monospace, monospace;
    --font-display: "Syne", system-ui, sans-serif;
    --font-brand: "Unica One", system-ui, sans-serif;
  }


  /* Sizes: re-derived wherever --u is set (see the header). */
  :root,
  [data-u-policy] {
    --fs-caption: calc(var(--u) * 0.8125);
    --fs-detail: calc(var(--u) * 0.875);
    --fs-body: calc(var(--u) * 1);
    --fs-title: calc(var(--u) * 1.25);
    --fs-display: calc(var(--u) * 2);
    /* spacing: padding, gaps, insets */
    --space-0: calc(var(--u) * 0.125);
    --space-1: calc(var(--u) * 0.25);
    --space-2: calc(var(--u) * 0.5);
    --space-3: calc(var(--u) * 0.75);
    --space-4: calc(var(--u) * 1);
    --space-5: calc(var(--u) * 1.5);
    --space-6: calc(var(--u) * 2);
    --space-8: calc(var(--u) * 3);
    /* component sizes, named by purpose */
    --control-sm: calc(var(--u) * 1.5);
    --control-md: calc(var(--u) * 2);
    --control-lg: calc(var(--u) * 2.5);
    --icon-sm: calc(var(--u) * 1);
    --icon-md: calc(var(--u) * 1.25);
    --mark-md: calc(var(--u) * 1.75);
    --mark-lg: calc(var(--u) * 2.25);
    --thumb-sm: calc(var(--u) * 2.5);
    --thumb-md: calc(var(--u) * 3.5);
    --thumb-lg: calc(var(--u) * 6);
    --tile-min: calc(var(--u) * 6.5);
    --card-min: calc(var(--u) * 15);
    --card-divider: var(--edge);
    --ring: calc(var(--u) * 0.125);
    --underline: calc(var(--u) * 0.25);
    --radius-1: calc(var(--u) * 0.25);
    --radius-2: calc(var(--u) * 0.5);
    --radius-3: calc(var(--u) * 1);
    --radius-full: 999em;
  }

  /* Scrollbars in the theme: thin, no track (the surface shows through), a
     thumb tinted from the text. The standard properties, so no ::-webkit
     rules are needed or read where these are supported. */
  * { scrollbar-width: thin; scrollbar-color: var(--scrollbar-thumb) transparent; }
  *:hover { scrollbar-color: var(--scrollbar-thumb-hover) transparent; }

  /* A scaled or zoomed page sizes its plain text from the unit too, not only
     its components. */
  :root:is([data-u-policy], [data-zoom]) > body { font-size: var(--fs-body); }

  [data-surface="inline"] { container-type: inline-size; }
  [data-surface="both"] { container-type: size; }

  [data-u-axis="inline"] { --_ub: 1cqi; }
  [data-u-axis="block"] { --_ub: 1cqb; }
  [data-u-axis="min"] { --_ub: 1cqmin; }
  [data-u-axis="max"] { --_ub: 1cqmax; }
  [data-u-axis="diagonal"] { --_ub: calc(hypot(1cqi, 1cqb) / 1.41421356); }

  /* The zoom multiplies OUTSIDE each expression, so zooming in is never
     clamped back by a scale's cap. */
  [data-u-policy="fixed"] {
    --u: calc(var(--u-base) * var(--u-zoom));
    --u-inline: calc(var(--u-base) * var(--u-zoom));
    --u-block: calc(var(--u-base) * var(--u-zoom));
  }
  [data-u-policy="clamped"] {
    --u: calc(clamp(var(--u-floor), calc(var(--_ub) * var(--u-factor)), var(--u-cap)) * var(--u-zoom));
    --u-inline: calc(clamp(var(--u-floor), calc(1cqi * var(--u-factor)), var(--u-cap)) * var(--u-zoom));
    --u-block: calc(clamp(var(--u-floor), calc(1cqb * var(--u-factor)), var(--u-cap)) * var(--u-zoom));
  }
  [data-u-policy="fluid"] {
    --u: calc(max(var(--u-floor), calc(var(--_ub) * var(--u-factor))) * var(--u-zoom));
    --u-inline: calc(max(var(--u-floor), calc(1cqi * var(--u-factor))) * var(--u-zoom));
    --u-block: calc(max(var(--u-floor), calc(1cqb * var(--u-factor))) * var(--u-zoom));
  }
}
`;
