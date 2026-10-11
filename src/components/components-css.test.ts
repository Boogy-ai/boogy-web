import { describe, it, expect } from 'vitest';
import { COMPONENTS_CSS } from './components-css';
import { FOUNDATION_CSS } from '../layout/foundation-css';
import { ruleFor } from '../../test-support/rule-for';

// Code only: comments are prose and may name sizes. Newlines kept for line numbers.
const CODE = COMPONENTS_CSS.replace(/\/\*[\s\S]*?\*\//g, (c) => c.replace(/[^\n]/g, ' '));

describe('component styles use the size scale', () => {
  it('multiply --u only inside a token definition, never in a rule', () => {
    const offenders = CODE.split('\n')
      .map((line, i) => ({ line: line.trim(), n: i + 1 }))
      .filter(({ line }) => line.includes('var(--u)') && !/^--[\w-]+\s*:/.test(line));
    expect(offenders, offenders.map((o) => `${o.n}: ${o.line}`).join('\n')).toEqual([]);
  });

  it('use no px or rem literal sizes (hairlines and the fixed touch minimum excepted)', () => {
    const offenders = CODE.split('\n')
      .map((line, i) => ({ line: line.trim(), n: i + 1 }))
      .filter(({ line }) => /(?<![\w.])(?:[2-9]|\d{2,})(?:\.\d+)?px|\d*\.?\d+rem/.test(line) && !/^--[\w-]+\s*:/.test(line) && !line.startsWith('@container'));
    expect(offenders, offenders.map((o) => `${o.n}: ${o.line}`).join('\n')).toEqual([]);
  });
});


describe('drawer head', () => {
  it('collapsed to the strip, the title entry gives its place to the toggle', () => {
    const body = ruleFor('[data-collapse-at="md"][data-expanded="false"] > [data-boogy="drawer"] [data-boogy="drawer-item"][data-variant="title"]');
    expect(body).toMatch(/display:\s*none/);
  });

  it('the toggle chevron is icon-md and turns to point where the drawer will go', () => {
    expect(ruleFor('[data-role="drawer-toggle"] > [data-slot="chevron"]')).toMatch(/width:\s*var\(--icon-md\)/);
    expect(ruleFor('[data-role="drawer-toggle"][aria-expanded="false"] > [data-slot="chevron"]')).toMatch(/scale:\s*-1 1/);
    expect(ruleFor('[data-side="end"] [data-role="drawer-toggle"] > [data-slot="chevron"]')).toMatch(/scale:\s*-1 1/);
  });
});

describe('drawer animation switch', () => {
  it('data-animate="false" removes every drawer transition, after the rules that set them', () => {
    const sel = '[data-boogy="drawer-layout"][data-animate="false"] > :is([data-boogy="drawer"], [data-boogy="drawer-backdrop"])';
    expect(ruleFor(sel)).toMatch(/transition:\s*none/);
    expect(CODE.lastIndexOf(sel)).toBeGreaterThan(CODE.lastIndexOf('transition: width'));
    expect(CODE.lastIndexOf(sel)).toBeGreaterThan(CODE.lastIndexOf('transition: translate'));
  });
});

describe('drawer entry size', () => {
  it('an entry mark is the large mark, so its letters sit with room around them', () => {
    expect(ruleFor('[data-boogy="drawer-item"] > [data-slot="mark"]')).toMatch(/width:\s*var\(--mark-lg\)/);
  });
  it('an entry is control-lg tall under a mouse; the 44px floor applies to touch only', () => {
    expect(ruleFor('  [data-boogy="drawer-item"]')).toMatch(/min-height:\s*var\(--control-lg\);/);
    const coarse = CODE.slice(CODE.indexOf('@media (pointer: coarse)'));
    expect(coarse).toMatch(/\[data-boogy="drawer-item"\] \{ min-height: var\(--touch-min\); \}/);
  });
});

describe('drawer entries: one box, never a box within a box', () => {
  const S = '[data-collapse-at="md"][data-expanded="false"] > [data-boogy="drawer"] [data-boogy="drawer-item"]';
  it('an entry mark draws no surface of its own; the entry surface is the box', () => {
    expect(ruleFor('[data-boogy="drawer-item"] > [data-slot="mark"]')).not.toMatch(/background:/);
  });
  it('collapsed, a plain entry is itself the filled square tile', () => {
    const body = ruleFor(S);
    expect(body).toMatch(/background:\s*var\(--fill-hover\)/);
    expect(body).toMatch(/width:\s*var\(--mark-lg\)/);
    expect(body).toMatch(/min-height:\s*var\(--mark-lg\)/);
  });
  it('framed: the mark is a themeable tile and the entry draws no surface, hover, current or collapsed', () => {
    const mark = ruleFor('[data-boogy="drawer-item"][data-variant="framed"] > [data-slot="mark"]');
    expect(mark).toMatch(/background:\s*var\(--drawer-mark-ground\)/);
    expect(mark).toMatch(/border:\s*1px solid var\(--drawer-mark-edge\)/);
    expect(mark).toMatch(/border-radius:\s*var\(--drawer-mark-radius\)/);
    for (const sel of [
      '[data-boogy="drawer-item"][data-variant="framed"]:is(:hover, [aria-current="page"])',
      `${S}[data-variant="framed"]`,
    ]) expect(ruleFor(sel), sel).toMatch(/background:\s*transparent/);
    expect(CODE.lastIndexOf(`${S}[data-variant="framed"]`)).toBeGreaterThan(CODE.lastIndexOf(`${S}[aria-current="page"]`));
  });
  it('framed: hover and current light the tile edge instead', () => {
    expect(ruleFor('[data-boogy="drawer-item"][data-variant="framed"]:hover > [data-slot="mark"]')).toMatch(/border-color:\s*var\(--drawer-mark-edge-hover\)/);
    expect(ruleFor('[data-boogy="drawer-item"][data-variant="framed"][aria-current="page"] > [data-slot="mark"]')).toMatch(/border-color:\s*var\(--drawer-mark-edge-current\)/);
  });
  it('entries have room above and below their mark', () => {
    expect(ruleFor('  [data-boogy="drawer-item"]')).toMatch(/padding:\s*var\(--space-1\) var\(--space-2\)/);
  });
});

describe('drawer resize handle', () => {
  it('is hidden by default and shown only docked and expanded', () => {
    expect(ruleFor('[data-boogy="drawer-resizer"]')).toMatch(/display:\s*none/);
    expect(ruleFor('[data-collapse-at="md"][data-resizable="true"][data-expanded="true"] > [data-boogy="drawer-resizer"]')).toMatch(/display:\s*block/);
  });
  it('replaces the drawer border there, so the edge is drawn once', () => {
    expect(ruleFor('[data-collapse-at="md"][data-resizable="true"][data-expanded="true"] > [data-boogy="drawer"]')).toMatch(/border-inline:\s*none/);
  });
  it('is a hairline in --drawer-edge that brightens to --drawer-edge-hover, with a col-resize cursor', () => {
    const body = ruleFor('  [data-boogy="drawer-resizer"]')!;
    expect(body).toMatch(/border-inline-start:\s*1px var\(--drawer-edge-style, solid\) var\(--drawer-edge\)/);
    expect(body).toMatch(/width:\s*0/);
    expect(body).toMatch(/cursor:\s*col-resize/);
    expect(ruleFor('[data-boogy="drawer-resizer"]:is(:hover, :focus-visible, [data-active="true"])')).toMatch(/border-inline-start-color:\s*var\(--drawer-edge-hover\)/);
  });
  it('the drawer edge is ONE thing, resizable or not: --drawer-edge in --drawer-edge-style (solid unless set)', () => {
    expect(CODE).toMatch(/border-inline-end:\s*1px var\(--drawer-edge-style, solid\) var\(--drawer-edge\)/);
    expect(CODE).toMatch(/border-inline-start:\s*1px var\(--drawer-edge-style, solid\) var\(--drawer-edge\)/);
    // The handle draws the same token, so the two states can never differ.
    expect(ruleFor('  [data-boogy="drawer-resizer"]')).toMatch(/var\(--drawer-edge\)/);
  });
  it('with the defaults, that edge is exactly --rule: the drawer edge is --edge and --rule is 1px solid --edge', () => {
    expect(CODE).toMatch(/--drawer-edge:\s*var\(--edge\)/);
  });
  it('widens the hit area beyond the hairline', () => {
    expect(ruleFor('[data-boogy="drawer-resizer"]::before')).toMatch(/inset-inline:\s*calc\(var\(--space-1\) \* -1\)/);
  });
  it('turns width transitions off while dragging', () => {
    expect(ruleFor('[data-boogy="drawer-layout"][data-resizing="true"] > [data-boogy="drawer"]')).toMatch(/transition:\s*none/);
  });
});

describe('drawer strip width', () => {
  it('includes the drawer edge, so a mark-lg tile fits inside a border-box strip unclipped', () => {
    expect(CODE).toMatch(/--drawer-strip-width:\s*calc\(var\(--mark-lg\) \+ 2 \* var\(--space-2\) \+ 1px\);/);
  });
  it("is declared on the drawer itself, so it follows the drawer's own unit (a drawer with its own scale keeps its collapsed width)", () => {
    const drawer = ruleFor('[data-boogy="drawer"]') ?? '';
    expect(drawer).toMatch(/--drawer-strip-width:/);
    expect(drawer).toMatch(/--drawer-overlay-width:/);
    expect(ruleFor('[data-boogy="drawer-layout"]') ?? '').not.toMatch(/--drawer-(strip|overlay)-width:/);
  });
});

describe('top bar', () => {
  it("in a sheet's head, a bar's shadow is the head's: cast from the head's edge, not from inside its padding", () => {
    const head = ruleFor('[data-boogy="sheet"] > [data-slot="head"]:has(> [data-boogy="top-bar"][data-shadow])');
    expect(head).toMatch(/box-shadow:\s*var\(--bar-shadow\)/);
    expect(head).toMatch(/position:\s*relative/);
    expect(head).toMatch(/z-index:\s*1/);
    expect(ruleFor('[data-boogy="sheet"] > [data-slot="head"] > [data-boogy="top-bar"][data-shadow]')).toMatch(/box-shadow:\s*none/);
  });
  it('a bar with `shadow` casts the bar shadow below it, over what scrolls under it', () => {
    const r = ruleFor('[data-boogy="top-bar"][data-shadow]');
    expect(r).toMatch(/box-shadow:\s*var\(--bar-shadow\)/);
    expect(r).toMatch(/z-index:\s*1/);
    // Downward only: every layer offset below, none to the sides.
    const token = /--bar-shadow:\s*([^;]+);/.exec(FOUNDATION_CSS)![1];
    // Its layers: the commas outside every parenthesis.
    const layers: string[] = [''];
    let depth = 0;
    for (const c of token) {
      depth += c === '(' ? 1 : c === ')' ? -1 : 0;
      if (c === ',' && depth === 0) layers.push('');
      else layers[layers.length - 1] += c;
    }
    expect(layers.length).toBeGreaterThan(0);
    for (const layer of layers) expect(layer.trim()).toMatch(/^0 [1-9]\d*px /);
  });

  it("a title carrying media (an avatar by a name) is a row, a gap between them, its text still truncating", () => {
    const MEDIA = '[data-boogy="top-bar"] > [data-slot="heading"] > [data-slot="title"]:has(> :is([data-boogy="avatar"], [data-boogy="thumbnail"], [data-boogy="glyph"]))';
    const row = ruleFor(MEDIA);
    expect(row).toMatch(/display:\s*flex/);
    expect(row).toMatch(/align-items:\s*center/);
    expect(row).toMatch(/gap:\s*var\(--space-2\)/);
    // Not clipped: the media's shadow falls outside the title's box (its text
    // truncates itself, below).
    expect(row).toMatch(/overflow:\s*visible/);
    const text = ruleFor(`${MEDIA} > :not([data-boogy])`);
    expect(text).toMatch(/min-inline-size:\s*0/);
    expect(text).toMatch(/overflow:\s*hidden/);
    expect(text).toMatch(/text-overflow:\s*ellipsis/);
    expect(ruleFor(`${MEDIA} > [data-boogy]`)).toMatch(/flex:\s*none/);
  });

  it('its title takes what is left, down to a minimum, on one line ending in an ellipsis', () => {
    expect(ruleFor('[data-boogy="top-bar"] > [data-slot="heading"]')).toMatch(/min-inline-size:\s*var\(--top-bar-title-min\)/);
    const title = ruleFor('[data-boogy="top-bar"] > [data-slot="heading"] > [data-slot="title"]')!;
    expect(title).toMatch(/text-overflow:\s*ellipsis/);
    expect(title).toMatch(/white-space:\s*nowrap/);
  });
  it('measures in a box of no size, so the measuring adds no overflow', () => {
    const m = ruleFor('[data-boogy="top-bar"] > [data-slot="measure"]')!;
    expect(m).toMatch(/inline-size:\s*0/);
    expect(m).toMatch(/overflow:\s*hidden/);
    expect(m).toMatch(/visibility:\s*hidden/);
  });
  it("a widget's row in the menu is its label and its controls on one line", () => {
    expect(ruleFor('[data-boogy="menu-row"]')).toMatch(/display:\s*flex/);
  });
  it("a widget's row and a menu item share one rule for their size, padding and ink", () => {
    const shared = ruleFor('[data-boogy="menu-row"], [data-boogy="menu-item"]')!;
    for (const d of ['min-height', 'padding', 'border-radius', 'color', 'font-size']) expect(shared).toMatch(new RegExp(`${d}:`));
    expect(ruleFor('[data-boogy="menu-row"]')).not.toMatch(/min-height:|border-radius:/);
  });
  it("More's rows have a faint hairline between each two, in the gap between them, and none above the first", () => {
    // The menu's gap between rows is one hairline, and the line fills it, so
    // it is never under a row's fill and the rows keep their padding.
    expect(ruleFor('  [data-boogy="menu"]')).toMatch(/gap:\s*var\(--hairline\);/);
    expect(ruleFor('[data-boogy="menu"] > [data-slot="row"]')).toMatch(/position:\s*relative/);
    const line = ruleFor('[data-boogy="menu"] > [data-slot="row"] ~ [data-slot="row"]::before')!;
    expect(line).toMatch(/content:\s*''/);
    expect(line).toMatch(/inset-block-start:\s*calc\(-1 \* var\(--hairline\)\)/);
    expect(line).toMatch(/block-size:\s*var\(--hairline\)/);
    expect(line).toMatch(/inset-inline:\s*0/);
    expect(line).toMatch(/background:\s*var\(--edge-faint\)/);
    // Only a row that follows another row draws one: nothing draws a line on every row, or on the first.
    const drawn = [...CODE.matchAll(/[^\n{}]*\[data-slot="row"\][^\n{}]*::before/g)].map((m) => m[0].trim());
    expect(drawn).toEqual(['[data-boogy="menu"] > [data-slot="row"] ~ [data-slot="row"]::before']);
    expect(CODE).not.toMatch(/\[data-slot="row"\][^{]*\{[^}]*border-(top|block-start)/);
  });
  it("a submenu row ends in its chevron, in the indicator's column, quieter than its label; while its content is open the row stays lit", () => {
    const chevron = ruleFor('[data-boogy="menu-item"] > [data-slot="submenu-indicator"]')!;
    expect(chevron).toMatch(/grid-area:\s*indicator/);
    expect(chevron).toMatch(/color:\s*var\(--text-3\)/);
    expect(ruleFor('[data-boogy="menu-item"][aria-expanded="true"]')).toMatch(/background:\s*var\(--fill-hover\)/);
  });
  it("reaches its items as children, never into a widget's own content", () => {
    expect(CODE).not.toMatch(/\[data-boogy="top-bar"\] \[data-item\]/);
    expect(ruleFor('[data-boogy="top-bar"] > [data-slot="measure"] > div > [data-item]')).toMatch(/flex:\s*none/);
    // A relative selector (starting with >) inside :is() or :where() is invalid there, and drops the rule.
    expect(CODE).not.toMatch(/:(is|where)\(\s*>/);
  });
});

describe('a multi-line field and a large one', () => {
  it('a textarea control grows with its text and shows at least its rows', () => {
    const area = ruleFor('[data-boogy="field"] > textarea[data-slot="control"]')!;
    expect(area).toMatch(/field-sizing:\s*content/);
    expect(area).toMatch(/min-block-size:\s*calc\(var\(--field-rows, 2\) \* 1lh/);
  });
  it('lg: a taller control at title size, its label at body size', () => {
    expect(ruleFor('[data-boogy="field"][data-size="lg"] > [data-slot="control"]')).toMatch(/font-size:\s*var\(--fs-title\)/);
    // Its taller minimum is a one-line input's: a multi-line control keeps its rows.
    expect(ruleFor('[data-boogy="field"][data-size="lg"] > [data-slot="control"]')).not.toMatch(/min-height/);
    expect(ruleFor('[data-boogy="field"][data-size="lg"] > input[data-slot="control"]')).toMatch(/min-height:\s*var\(--control-lg\)/);
    expect(ruleFor('[data-boogy="field"][data-size="lg"] > [data-slot="label"]')).toMatch(/font-size:\s*var\(--fs-body\)/);
  });
});

describe('a sheet with a head of its own', () => {
  it("keeps the head's frame (its edge and padding), and none of the title's type", () => {
    expect(ruleFor('[data-boogy="sheet"] > [data-slot="head"][data-head="own"]')).toMatch(/font-size:\s*var\(--fs-body\)/);
    expect(ruleFor('[data-boogy="sheet"] > [data-slot="head"][data-head="own"] > *')).toMatch(/flex:\s*1 1 auto/);
  });
});

describe('sheet stacking', () => {
  it('stacks over what the components stack in a page, and under a drawer overlay', () => {
    const z = Number(/z-index:\s*(\d+)/.exec(ruleFor('[data-boogy="sheet"]')!)?.[1]);
    expect(z).toBeGreaterThan(1);
    expect(z).toBeLessThan(19);
  });
});

describe('button sizes', () => {
  it('lg is the large control, its text a step up from the body', () => {
    const lg = ruleFor('[data-boogy="button"][data-size="lg"]')!;
    expect(lg).toMatch(/--_h:\s*var\(--control-lg\)/);
    expect(lg).toMatch(/font-size:\s*var\(--fs-body\)/);
  });
});

describe('button outline variant', () => {
  it('is a faint edge on no fill; hover lights the fill and brightens edge and text', () => {
    const rest = ruleFor('[data-boogy="button"][data-variant="outline"]')!;
    expect(rest).toMatch(/border:\s*1px solid var\(--button-outline-edge, var\(--edge\)\)/);
    // Settable from an ancestor: the button must not declare the token itself.
    expect(ruleFor('  [data-boogy="button"]')).not.toMatch(/--button-outline-edge\s*:/);
    expect(rest).toMatch(/color:\s*var\(--text-3\)/);
    expect(rest).not.toMatch(/background:/);
    const hover = ruleFor('[data-boogy="button"][data-variant="outline"]:not(:disabled, [aria-disabled="true"]):hover')!;
    expect(hover).toMatch(/border-color:\s*var\(--button-outline-edge-hover, var\(--edge-strong\)\)/);
    expect(hover).toMatch(/color:\s*var\(--text-1\)/);
    expect(hover).toMatch(/background:\s*var\(--fill-hover\)/);
  });
});

describe('popover styles', () => {
  it('anchored: fixed in the top layer, with the browser popover defaults undone', () => {
    const body = ruleFor('  [data-boogy="popover"]')!;
    expect(body).toMatch(/position:\s*fixed/);
    expect(body).toMatch(/margin:\s*0/);
    expect(body).toMatch(/inset:\s*auto/);
    expect(body).toMatch(/overflow:\s*auto/);
    expect(body).toMatch(/background:\s*var\(--popover-ground, var\(--ground-raised\)\)/);
  });
  it('enters with a fade and a small scale, and holds still under reduced motion', () => {
    expect(CODE).toMatch(/@starting-style\s*\{\s*\[data-boogy="popover"\]\s*\{[^}]*opacity:\s*0/);
    expect(CODE).toMatch(/prefers-reduced-motion: reduce\)\s*\{\s*\[data-boogy="popover"\]\s*\{\s*transition:\s*none/);
  });
  it('sets no size of its own over its content\'s, so a size given to it wins; a page is the whole screen', () => {
    expect(CODE).not.toContain('[data-boogy="popover"][popover]');
    const page = ruleFor('[data-boogy="popover"][data-mode="page"]')!;
    expect(page).toMatch(/width:\s*100%/);
    expect(page).toMatch(/height:\s*100%/);
  });
  it('page: the whole screen, a head and a scrolling body', () => {
    const page = ruleFor('[data-boogy="popover"][data-mode="page"]')!;
    expect(page).toMatch(/inset:\s*0/);
    expect(page).toMatch(/border-radius:\s*0/);
    expect(ruleFor('[data-boogy="popover"] > [data-slot="body"]')).toMatch(/overflow:\s*auto/);
    expect(ruleFor('[data-boogy="popover"] > [data-slot="head"]')).toMatch(/display:\s*flex/);
  });
});

describe('menu styles', () => {
  it('a menu is a padded column that takes at least its trigger\'s width', () => {
    const m = ruleFor('  [data-boogy="menu"]')!;
    expect(m).toMatch(/flex-direction:\s*column/);
    expect(m).toMatch(/min-width:\s*max\(var\(--trigger-width, 0px\), var\(--menu-min-width\)\)/);
  });
  it('the focused item takes the hover fill; danger is red; disabled is dimmed', () => {
    expect(ruleFor('[data-boogy="menu-item"]:focus')).toMatch(/background:\s*var\(--fill-hover\)/);
    expect(ruleFor('[data-boogy="menu-item"][data-variant="danger"]')).toMatch(/color:\s*var\(--danger\)/);
    expect(ruleFor('[data-boogy="menu-item"][data-disabled="true"]')).toMatch(/opacity:/);
  });
  it('lays out label over description, with the shortcut and indicator on the right', () => {
    expect(ruleFor('[data-boogy="menu-item"] > [data-slot="label"]')).toMatch(/grid-area:\s*label/);
    expect(ruleFor('[data-boogy="menu-item"] > [data-slot="description"]')).toMatch(/grid-area:\s*description/);
    expect(ruleFor('[data-boogy="menu-item"] > [data-slot="kbd"]')).toMatch(/grid-area:\s*kbd/);
    expect(ruleFor('[data-boogy="menu-item"] > [data-slot="indicator"]')).toMatch(/grid-area:\s*indicator/);
    // Its rows are packed in the middle: an item with no description keeps
    // its label centred in a row taller than it, level with its icon, rather
    // than above an empty description row that took half the height.
    expect(ruleFor('  [data-boogy="menu-item"]')).toMatch(/align-content:\s*center/);
  });
  it('has section headers and separators', () => {
    expect(ruleFor('[data-boogy="menu-section"] > [data-slot="header"]')).toMatch(/color:\s*var\(--text-3\)/);
    expect(ruleFor('[data-boogy="menu-separator"]')).toMatch(/background:\s*var\(--edge\)/);
  });
});

describe('focus rings', () => {
  it('every focus ring is drawn in the ring colour, never the raw accent', () => {
    const colours = [...CODE.matchAll(/outline:\s*var\(--ring\)\s+solid\s+([^;}]+?)\s*[;}]/g)].map((m) => m[1]);
    expect(colours.length).toBeGreaterThanOrEqual(8);
    expect(colours.filter((c) => c !== 'var(--ring-color)')).toEqual([]);
  });
  it('the ring colour is the accent, quietened only on a dark ground', () => {
    // Light grounds keep the full accent: fading it there would drop the ring
    // below the contrast a focus indicator needs against a pale surface.
    const ring = FOUNDATION_CSS.match(/--ring-color:\s*([^;]+);/)?.[1];
    expect(ring).toMatch(/^light-dark\(var\(--accent\),\s*oklch\(from var\(--accent\) l c h \/ 0\.\d+\)\)$/);
  });
});

describe('covers', () => {
  it('a carousel is a 16:10 frame, capped in height so a stretched card crops wider rather than growing taller', () => {
    const rule = ruleFor('[data-boogy="carousel"]')!;
    expect(rule).toContain('aspect-ratio: var(--cover-aspect, 16 / 10)');
    expect(rule).toContain('max-height: var(--cover-max-height, var(--_cover-max))');
    expect(rule).toContain('--_cover-max: calc(var(--u) * 12)');
  });
  it("an empty carousel's fallback fills that same frame", () => {
    expect(ruleFor('[data-boogy="carousel"] > [data-slot="fallback"]')).toContain('inset: 0');
  });
  it('carousel images fill the frame (cover), whatever their own shape', () => {
    expect(ruleFor('[data-boogy="carousel"] > img')).toContain('object-fit: cover');
  });
  it("the pager's controls sit above a card's covering title control", () => {
    expect(ruleFor('[data-boogy="carousel"] > :is([data-slot="prev"], [data-slot="next"])')).toContain('z-index: 1');
    expect(ruleFor('[data-boogy="carousel"] > [data-slot="dots"]')).toContain('z-index: 1');
  });
});

describe('drawer mark initials', () => {
  it('are trimmed to cap height, so the mark centres the letters rather than their line box', () => {
    expect(ruleFor('[data-boogy="drawer-item"] > [data-slot="mark"] > [data-slot="initials"]')).toMatch(/text-box:\s*trim-both cap alphabetic/);
  });
});

describe('inline edit', () => {
  it('reads as text at rest: no edge, no ground, sized to its content', () => {
    const rest = ruleFor('[data-boogy="inline-edit"]')!;
    expect(rest).toContain('border: 1px solid transparent');
    expect(rest).toContain('background: transparent');
    expect(rest).toContain('field-sizing: content');
    expect(rest).toContain('font: inherit');
  });
  it('shows its edge when pointed at, and its field when focused', () => {
    expect(ruleFor('[data-boogy="inline-edit"]:hover')).toContain('border-color: var(--edge)');
    const focus = ruleFor('[data-boogy="inline-edit"]:focus')!;
    expect(focus).toContain('border-color: var(--edge-strong)');
    expect(focus).toContain('background: var(--ground-sunken)');
  });
});

describe('swatch', () => {
  it('is a round chip at icon size, filled from --swatch-color, with an edge so a dark colour still shows', () => {
    const rule = ruleFor('[data-boogy="swatch"]')!;
    expect(rule).toContain('width: var(--icon-sm)');
    expect(rule).toContain('height: var(--icon-sm)');
    expect(rule).toContain('border-radius: 50%');
    expect(rule).toContain('background: var(--swatch-color, transparent)');
    // A border inside the chip's size, not a shadow: shadows are role tokens only.
    expect(rule).toContain('box-sizing: border-box');
    expect(rule).toContain('border: 1px solid var(--edge-strong)');
    expect(rule).not.toContain('box-shadow');
  });
});

describe('menu item icon slot', () => {
  it('gives an item with a leading icon its own column, and leaves items without one alone', () => {
    const withIcon = ruleFor('[data-boogy="menu-item"]:has(> [data-slot="icon"])')!;
    expect(withIcon).toContain('grid-template-columns: auto 1fr auto auto');
    expect(withIcon).toContain('"icon label kbd indicator" "icon description kbd indicator"');
    expect(ruleFor('[data-boogy="menu-item"] > [data-slot="icon"]')).toContain('grid-area: icon');
    expect(ruleFor('[data-boogy="menu-item"] > [data-slot="icon"]')).toContain('grid-area: icon');
  });
  it("a widget row's icon and an item's icon share one rule for size and ink, and the label takes the room between", () => {
    const shared = ruleFor('[data-boogy="menu-item"] > [data-slot="icon"], [data-boogy="menu-row"] > [data-slot="icon"]')!;
    expect(shared).toContain('display: flex');
    expect(shared).toContain('color: var(--text-2)');
    expect(ruleFor('[data-boogy="menu-row"] > [data-slot="label"]')).toContain('flex: 1');
    expect(ruleFor('[data-boogy="menu-item"]')).toContain('grid-template-columns: 1fr auto auto');
  });
});

describe('tabs', () => {
  it('a row of tabs on a neutral line, the selected one in the full ink with the accent line over it, exactly', () => {
    // Both lines are a background of the underline's height at the bottom of
    // their box (one geometry for the row, its tabs and a tabbed TopBar), so
    // the selected one lies exactly over the row's: a border under a negative
    // margin rounded a pixel apart.
    const LINES = '[data-boogy="tab-list"],\n  [data-boogy="tab-list"] > [data-slot="tab"],\n  [data-boogy="top-bar"]:has(> [data-slot="heading"] > [data-boogy="tab-list"])';
    const geometry = ruleFor(LINES);
    expect(geometry).toMatch(/background-position:\s*bottom/);
    expect(geometry).toMatch(/background-size:\s*100% var\(--underline\)/);
    expect(geometry).toMatch(/background-repeat:\s*no-repeat/);
    // The row's line: neutral (no accent), so only the selected tab is coloured.
    expect(ruleFor('[data-boogy="tab-list"],\n  [data-boogy="top-bar"]:has(> [data-slot="heading"] > [data-boogy="tab-list"])')).toMatch(/background-image:\s*linear-gradient\(var\(--edge-strong\), var\(--edge-strong\)\)/);
    const t = ruleFor('[data-boogy="tab-list"] > [data-slot="tab"]')!;
    expect(t).toContain('color: var(--text-2)');
    // Every tab reserves the underline's room, so selecting one never shifts
    // its label; its line is drawn in that room.
    expect(t).toContain('border-bottom: var(--underline) solid transparent');
    expect(t).toContain('background-origin: border-box');
    expect(t).not.toMatch(/margin-bottom/);
    const on = ruleFor('[data-boogy="tab-list"] > [data-slot="tab"][aria-selected="true"]')!;
    expect(on).toContain('color: var(--text-1)');
    expect(on).toMatch(/background-image:\s*linear-gradient\(var\(--accent\), var\(--accent\)\)/);
  });
});

describe('tab glyphs', () => {
  it('a tab with a glyph centres the glyph and its label on one line, a gap apart; the glyph at the icon size, in the tab\'s colour', () => {
    const t = ruleFor('[data-boogy="tab-list"] > [data-slot="tab"]:has(> [data-slot="icon"])');
    expect(t).toMatch(/display:\s*inline-flex/);
    expect(t).toMatch(/align-items:\s*center/);
    expect(t).toMatch(/justify-content:\s*center/);
    expect(t).toMatch(/gap:\s*var\(--space-2\)/);
    const icon = ruleFor('[data-boogy="tab-list"] > [data-slot="tab"] > [data-slot="icon"]');
    expect(icon).toMatch(/font-size:\s*var\(--icon-md\)/);
    expect(icon).toMatch(/flex:\s*none/);
    expect(icon).not.toMatch(/color:/);
  });
});

describe('tabs in a top bar', () => {
  it("in a TopBar the bar draws the row's line, across its whole width (under its actions too); the row draws none of its own", () => {
    expect(ruleFor('[data-boogy="top-bar"] > [data-slot="heading"] > [data-boogy="tab-list"]')).toMatch(/background-image:\s*none/);
  });
  it("a TopBar's tab row fills the bar's height, so the selected tab's line is the bar's bottom edge", () => {
    expect(ruleFor('[data-boogy="top-bar"] > [data-slot="heading"]:has(> [data-boogy="tab-list"])')).toMatch(/align-self:\s*stretch/);
  });
  it('a panel shown apart from its row draws no focus outline of its own, as the tabs\' panel does not', () => {
    expect(ruleFor('[data-boogy="tab-panel"]')).toMatch(/outline:\s*none/);
  });
});

describe('tabs fill', () => {
  it('a filled bar gives every tab an equal share of its width', () => {
    expect(ruleFor('[data-boogy="tab-list"][data-fill="true"] > [data-slot="tab"]')).toContain('flex: 1 1 0');
  });
});

describe('tab padding', () => {
  it('a tab is padded --space-2 on every side (its vertical padding was --space-1)', () => {
    expect(ruleFor('[data-boogy="tab-list"] > [data-slot="tab"]')).toContain('padding: var(--space-2);');
  });
});

describe('opaque covering surfaces', () => {
  it('a page popover covers the app with the solid ground, never the translucent one', () => {
    expect(ruleFor('[data-boogy="popover"][data-mode="page"]')).toContain('background: var(--popover-ground, var(--ground-solid))');
  });
  it("the drawer's mark tile is solid too", () => {
    expect(ruleFor('[data-boogy="drawer-layout"]')).toContain('--drawer-mark-ground: var(--ground-solid)');
  });
});

describe('tab dividers', () => {
  it('a faint line between neighbouring tabs, inset from the row\'s top and bottom', () => {
    const d = ruleFor('[data-boogy="tab-list"] > [data-slot="tab"] + [data-slot="tab"]::before');
    expect(d).toContain('position: absolute');
    expect(d).toContain('inset-block: var(--space-2)');
    expect(d).toContain('inset-inline-start: 0');
    expect(d).toContain('border-inline-start: 1px solid var(--edge)');
    expect(ruleFor('[data-boogy="tab-list"] > [data-slot="tab"]')).toContain('position: relative');
  });
  it('the tabs sit edge to edge, so a divider is exactly between two; their padding spaces the labels', () => {
    expect(ruleFor('[data-boogy="tab-list"]')).toContain('gap: 0');
  });
});

describe('list item meta', () => {
  it('the heading row holds the title and, pushed to its end on the title\'s baseline, the meta', () => {
    const h = ruleFor('[data-boogy="list-item"] [data-slot="heading"]');
    expect(h).toContain('display: flex');
    expect(h).toContain('align-items: baseline');
    const m = ruleFor('[data-boogy="list-item"] [data-slot="meta"]');
    expect(m).toContain('margin-inline-start: auto');
    expect(m).toContain('color: var(--text-3)');
    expect(m).toContain('font-size: var(--fs-caption)');
  });
});

describe('a list item squeezed narrow', () => {
  it("gives up its meta before its title: the name is the row, the time is a detail", () => {
    // Was `flex: none`: at a large zoom in a narrow pane the title shrank to
    // nothing while the time kept its full width.
    const meta = ruleFor('[data-boogy="list-item"] [data-slot="meta"]');
    expect(meta).toMatch(/flex: 0 999 auto/);
    expect(meta).toMatch(/min-width: 0/);
    expect(meta).toMatch(/text-overflow: ellipsis/);
    expect(meta).toMatch(/overflow: hidden/);
    // The title does not shrink while the meta has width to give, and is
    // capped at the row, so a long name still ellipsizes on its own.
    const title = ruleFor('[data-boogy="list-item"] [data-slot="heading"] > [data-slot="title"]');
    expect(title).toMatch(/flex: 1 0 auto/);
    expect(title).toMatch(/max-width: 100%/);
  });
});

describe('fit-text', () => {
  it('sizes the font between its bounds by the fitted factor, with every word whole', () => {
    const rule = ruleFor('[data-boogy="fit-text"]')!;
    expect(rule).toContain('font-size: calc(var(--fit-min) + (var(--fit-max) - var(--fit-min)) * var(--fit, 1))');
    expect(rule).toContain('overflow-wrap: normal');
  });

  it('breaks a word only once the text overflows even at its minimum', () => {
    expect(ruleFor('[data-boogy="fit-text"][data-overflow="true"]')).toContain('overflow-wrap: anywhere');
  });

  it('is a block whatever its tag: an inline box has no size to fit within', () => {
    expect(ruleFor('[data-boogy="fit-text"]')).toContain('display: block');
  });
});

describe('fill-grid', () => {
  it('wraps its children centred, each cell a share of the box by --cols and --rows', () => {
    expect(ruleFor('[data-boogy="fill-grid"]')).toMatch(/flex-wrap:\s*wrap/);
    // Its cells: never a popover shown among them, at one attribute's weight.
    const cell = ruleFor('[data-boogy="fill-grid"] > :where(:not([popover]))')!;
    expect(cell).toContain('var(--cols, 1)');
    expect(cell).toContain('var(--rows, 1)');
  });

  it('falls back to one scrolling column at the minimum cell height', () => {
    expect(ruleFor('[data-boogy="fill-grid"][data-fallback="true"]')).toMatch(/overflow-y:\s*auto/);
    expect(ruleFor('[data-boogy="fill-grid"][data-fallback="true"] > :where(:not([popover]))')).toContain('block-size: var(--fill-min-block)');
  });
});

describe('segments (meter and column chart share them)', () => {
  it('fills a segment from --segment-color, and stripes it at 45° when asked', () => {
    expect(ruleFor('[data-slot="segment"]')).toContain('background: var(--segment-color)');
    const stripes = ruleFor('[data-slot="segment"][data-pattern="stripes"]')!;
    // One tiled 45° square, never a repeating gradient: an engine can draw a
    // repeating gradient with oklch() stops as stray lines (the browser test
    // reads the pixels).
    expect(stripes).toContain('linear-gradient(45deg');
    expect(stripes).not.toContain('repeating-linear-gradient');
    expect(stripes).toMatch(/background-size:\s*var\(--space-\d\) var\(--space-\d\)/);
  });
});

describe('meter', () => {
  it('is a rounded track its segments fill from the start', () => {
    const rule = ruleFor('[data-boogy="meter"]')!;
    expect(rule).toMatch(/display:\s*flex/);
    expect(rule).toContain('border-radius: var(--radius-full)');
    expect(rule).toMatch(/overflow:\s*hidden/);
  });
});

describe('switch', () => {
  it('has a track whose thumb moves to the end when on', () => {
    expect(ruleFor('[data-boogy="switch"] [data-slot="track"]')).toBeTruthy();
    expect(ruleFor('[data-boogy="switch"][aria-checked="true"] [data-slot="thumb"]')).toMatch(/translate/);
  });
});

describe('switch, disabled', () => {
  it('shows it cannot be pressed: dimmed, with no pointer cursor', () => {
    const r = ruleFor('[data-boogy="switch"]:disabled')!;
    expect(r).toMatch(/opacity:\s*0\.45/);
    expect(r).toMatch(/cursor:\s*default/);
  });
});

describe('choice-group radios', () => {
  it('are drawn in the accent, at a size from the icon tokens', () => {
    const r = ruleFor('[data-boogy="choice-group"] [data-slot="choice"] > input')!;
    expect(r).toContain('accent-color: var(--accent)');
    expect(r).toMatch(/inline-size:\s*var\(--icon-sm\)/);
    expect(r).toMatch(/block-size:\s*var\(--icon-sm\)/);
  });
  it('a disabled choice is dimmed and not clickable-looking', () => {
    expect(ruleFor('[data-boogy="choice-group"]:disabled')).toMatch(/opacity:\s*0\.45/);
  });
});

describe('choice-group', () => {
  it('stacks its choices, each a radio beside its label and description', () => {
    expect(ruleFor('[data-boogy="choice-group"]')).toMatch(/display:\s*grid/);
    expect(ruleFor('[data-boogy="choice-group"] [data-slot="choice"]')).toMatch(/display:\s*grid/);
  });
});

describe('data-table', () => {
  it('has a sticky header and right-aligns numeric columns in tabular figures', () => {
    expect(ruleFor('[data-boogy="data-table"] thead th')).toMatch(/position:\s*sticky/);
    const numeric = ruleFor('[data-boogy="data-table"] [data-numeric="true"]')!;
    expect(numeric).toMatch(/text-align:\s*end/);
    expect(numeric).toContain('font-variant-numeric: tabular-nums');
  });

  it('lets a control in the title cell cover the whole row, through the shared generator', () => {
    expect(ruleFor('[data-boogy="data-table"] tbody tr:has([data-slot="title"] > :is(button, a))')).toMatch(/position:\s*relative/);
  });
});

describe('stat', () => {
  it('stacks the value over its label and caption', () => {
    expect(ruleFor('[data-boogy="stat"]')).toMatch(/display:\s*grid/);
    // Packed to the top: stretched beside a stat with a caption, one without
    // keeps its label under its value.
    expect(ruleFor('[data-boogy="stat"]')).toMatch(/align-content:\s*start/);
  });
  it('sets the value in tabular figures of the body face, semibold, so a live value never changes width as its digits change', () => {
    const value = ruleFor('[data-boogy="stat"] > [data-slot="value"]');
    expect(value).toContain('font-variant-numeric: tabular-nums');
    expect(value).toContain('font-weight: 600');
    expect(value).not.toMatch(/font-family/);
  });
  it('keeps the value on one line: with no height to bound it, a wrapped value would always fit, and never shrink', () => {
    expect(ruleFor('[data-boogy="stat"] > [data-slot="value"]')).toContain('white-space: nowrap');
  });
});

describe('column-chart', () => {
  it('lays columns side by side, each stacking its segments from the bottom', () => {
    expect(ruleFor('[data-boogy="column-chart"] [data-slot="columns"]')).toMatch(/display:\s*flex/);
    expect(ruleFor('[data-boogy="column-chart"] [data-slot="column"]')).toMatch(/flex-direction:\s*column-reverse/);
  });
  it('clips what it holds, falling back to hidden where clip is not supported', () => {
    // Declared in this order, an engine without `clip` keeps `hidden`.
    expect(ruleFor('[data-boogy="column-chart"]')).toMatch(/overflow:\s*hidden;\s*overflow:\s*clip;/);
  });
  it('spells the gap between a column\'s segments once, as a custom property the heights are computed with', () => {
    expect(ruleFor('[data-boogy="column-chart"]')).toMatch(/--chart-segment-gap:\s*var\(--space-0\);/);
    expect(ruleFor('[data-boogy="column-chart"] [data-slot="column"]')).toMatch(/(?:^|[;\s])gap:\s*var\(--chart-segment-gap\);/);
  });
});

describe('visually hidden', () => {
  it('keeps content for assistive technology while drawing nothing', () => {
    const rule = ruleFor('[data-visually-hidden]')!;
    expect(rule).toContain('clip-path: inset(50%)');
    expect(rule).toMatch(/position:\s*absolute/);
  });
});

describe('soft button', () => {
  const soft = '[data-boogy="button"][data-variant="soft"]';
  const live = ':not(:disabled, [aria-disabled="true"])';
  it('is a translucent fill at rest, a step stronger on hover and press', () => {
    expect(ruleFor(soft)).toMatch(/background:\s*var\(--fill-selected\)/);
    expect(ruleFor(`${soft}${live}:hover`)).toMatch(/background:\s*var\(--fill-strong\)/);
    expect(ruleFor(`${soft}${live}:active`)).toMatch(/background:\s*var\(--fill-strong\)/);
  });
  it('has its stronger fill defined as a token', () => {
    expect(FOUNDATION_CSS).toContain('--fill-strong: color-mix(in oklch, var(--text-1) 18%, transparent)');
  });
});

describe('menu item cursor', () => {
  it('a menu item a press acts on shows the pointer; a disabled one the arrow', () => {
    expect(ruleFor('[data-boogy="menu-item"]')).toMatch(/cursor:\s*pointer/);
    expect(ruleFor('[data-boogy="menu-item"][data-disabled="true"]')).toMatch(/cursor:\s*default/);
  });
});

describe('flat popover', () => {
  it("has a small shadow (the menu role's, not the raised popover's), and a slight radius (it and its menu rows) unless the app sets another", () => {
    const body = ruleFor('[data-boogy="popover"][data-variant="flat"]');
    expect(body).toMatch(/box-shadow:\s*var\(--menu-shadow\)/);
    expect(ruleFor('[data-boogy="popover"][data-variant="flat"] :is([data-boogy="menu-item"], [data-boogy="menu-row"])')).toMatch(/border-radius:\s*var\(--popover-row-radius, var\(--radius-1\)\)/);
    expect(body).toMatch(/border-radius:\s*var\(--popover-radius, var\(--radius-1\)\)/);
  });
  it('is frosted: its ground, a little see-through, over a blur of what is behind it', () => {
    const body = ruleFor('[data-boogy="popover"][data-variant="flat"]');
    expect(body).toMatch(/background:\s*color-mix\(in oklch, var\(--popover-ground, var\(--ground-frost\)\) var\(--popover-frost\), transparent\)/);
    // Its own ground is glass, not the raised ground (near black in dark): a
    // mid grey in dark, near white in light, in the theme's tint.
    const frost = /--ground-frost:\s*light-dark\(oklch\(([\d.]+) var\(--tint\) var\(--hue\)\), oklch\(([\d.]+) var\(--tint\) var\(--hue\)\)\);/.exec(FOUNDATION_CSS)!;
    expect(Number(frost[1])).toBeGreaterThan(0.9);
    expect(Number(frost[2])).toBeGreaterThanOrEqual(0.25);
    expect(Number(/--popover-frost:\s*(\d+)%/.exec(FOUNDATION_CSS)![1])).toBeLessThanOrEqual(75);
    expect(body).toMatch(/backdrop-filter:\s*blur\(var\(--blur-md\)\)/);
    expect(FOUNDATION_CSS).toMatch(/--popover-frost:\s*\d+%/);
    // A popover filling the screen covers it: solid, nothing to blur.
    expect(ruleFor('[data-boogy="popover"][data-mode="page"]')).toMatch(/backdrop-filter:\s*none/);
  });
});

describe('blur scale', () => {
  it('names its blur radii by size, each from the unit, small to large', () => {
    expect(FOUNDATION_CSS).toMatch(/--blur-sm:\s*calc\(var\(--u\) \* 0\.25\)/);
    expect(FOUNDATION_CSS).toMatch(/--blur-md:\s*calc\(var\(--u\) \* 0\.5\)/);
    expect(FOUNDATION_CSS).toMatch(/--blur-lg:\s*calc\(var\(--u\) \* 1\)/);
  });
});

describe('sample grid', () => {
  const G = '[data-boogy="sample-grid"]';
  it('lays its tiles out in `columns` columns of --sample-md rows, and scrolls past `rows` of them', () => {
    const grid = ruleFor(G);
    expect(grid).toMatch(/display:\s*grid/);
    expect(grid).toMatch(/grid-template-columns:\s*repeat\(var\(--sample-grid-columns\), minmax\(0, 1fr\)\)/);
    expect(grid).toMatch(/grid-auto-rows:\s*var\(--sample-md\)/);
    expect(grid).toMatch(/max-block-size:\s*calc\(var\(--sample-grid-rows\) \* \(var\(--sample-md\) \+ var\(--space-1\)\) - var\(--space-1\)\)/);
    expect(grid).toMatch(/overflow-y:\s*auto/);
    // Room for a tile's ring, which the scroll box would clip at its edges.
    expect(grid).toMatch(/padding:\s*var\(--ring\)/);
    expect(FOUNDATION_CSS).toMatch(/--sample-md:\s*calc\(var\(--u\) \* 3\)/);
  });
  it("a tile is a hairline-edged button with the grid's radius, none under a flat popover", () => {
    expect(ruleFor(G)).toMatch(/--sample-grid-radius:\s*var\(--radius-1\)/);
    expect(ruleFor(`[data-boogy="popover"][data-variant="flat"] ${G}`)).toMatch(/--sample-grid-radius:\s*0;/);
    const tile = ruleFor(`${G} > [data-slot="sample"]`);
    expect(tile).toMatch(/border:\s*var\(--rule\)/);
    expect(tile).toMatch(/border-radius:\s*var\(--sample-grid-radius\)/);
  });
  it("shares the colour picker's swatch states: hover, chosen, focus", () => {
    for (const state of [':hover', '[aria-pressed="true"]', ':focus-visible']) {
      expect(CODE, state).toMatch(new RegExp(`\\[data-boogy="sample-grid"\\] > \\[data-slot="sample"\\]${state.replace(/[[\]"]/g, (c) => '\\' + c)},\\s*\\n\\s*\\[data-boogy="color-picker"\\]`));
    }
  });
});

describe('color picker', () => {
  const P = '[data-boogy="color-picker"]';
  /** Every rule whose selector names the picker: [selector, body]. */
  const rules = [...CODE.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
    .filter((m) => m[1].includes(P))
    .map((m) => [m[1].trim(), m[2]] as const);
  // The picker's sliders share their track and thumb with the size controls' slider.
  const SLIDERS = `:is(${P} :is([data-slot="hue"], [data-slot="opacity"] > input), [data-boogy="zoom-controls"] > [data-slot="slider"])`;

  it('has its rules', () => {
    expect(rules.length).toBeGreaterThan(10);
  });

  it('is a stack of sections, each inside the picker\'s padding, a hairline between each two and none above the first', () => {
    expect(ruleFor(P)).toMatch(/display:\s*grid/);
    expect(ruleFor(P)).not.toMatch(/(?:^|[\s;])(?:gap|padding):/);
    expect(ruleFor(`${P} > [data-slot]`)).toMatch(/padding:\s*var\(--space-3\)/);
    expect(ruleFor(`${P} > [data-slot] + [data-slot]`)).toMatch(/border-top:\s*var\(--rule\)/);
  });

  it('has one corner radius, the small one, and none under a flat popover', () => {
    expect(ruleFor(P)).toMatch(/--color-picker-radius:\s*var\(--radius-1\)/);
    expect(ruleFor(`[data-boogy="popover"][data-variant="flat"] ${P}`)).toMatch(/--color-picker-radius:\s*0;/);
    const rounded = rules.filter(([, body]) => /border-radius:/.test(body));
    for (const [sel, body] of rounded) {
      expect(body, sel).toMatch(/border-radius:\s*var\(--(?:color-picker-radius(?:, var\(--radius-1\))?|radius-full)\)/);
    }
  });

  it('lays its swatches out as a compact grid: `columns` square chips per row, a chip at least --chip-md, a hairline gap', () => {
    const grid = ruleFor(`${P} > [data-slot="swatches"]`);
    expect(grid).toMatch(/display:\s*grid/);
    expect(grid).toMatch(/grid-template-columns:\s*repeat\(var\(--color-picker-columns\), minmax\(var\(--chip-md\), 1fr\)\)/);
    expect(grid).toMatch(/gap:\s*var\(--space-0\)/);
    const chip = ruleFor(`${P} [data-slot="swatch"]`);
    expect(chip).toMatch(/aspect-ratio:\s*1;/);
    expect(chip).toMatch(/background:\s*var\(--swatch-color, transparent\)/);
    // A hairline inside its edge, over its colour, so a chip close to the
    // menu's ground (black on black, white on white) still reads as a chip.
    expect(chip).toMatch(/border:\s*var\(--rule\)/);
    expect(FOUNDATION_CSS).toMatch(/--chip-md:\s*calc\(var\(--u\) \* [\d.]+\);/);
  });

  it('rings the chosen chip, and the custom colour\'s preview while a custom colour is chosen, in the ink with a ring of the ground inside: it reads on any colour', () => {
    const chosen = ruleFor(`${P} :is([data-slot="swatch"][aria-pressed="true"], [data-slot="custom"][data-pressed="true"] [data-slot="preview"])`);
    expect(chosen).toMatch(/border:\s*var\(--ring\) solid var\(--text-1\)/);
    expect(chosen).toMatch(/box-shadow:\s*inset 0 0 0 var\(--ring\) var\(--ground-solid\)/);
    // After the hover rule, so hovering the chosen chip keeps its ring.
    expect(CODE.indexOf('[data-slot="swatch"][aria-pressed="true"]')).toBeGreaterThan(CODE.indexOf(`${P} [data-slot="swatch"]:hover`));
    expect(ruleFor(`${P} [data-slot="swatch"]:focus-visible`)).toMatch(/outline:\s*var\(--ring\) solid var\(--ring-color\)/);
  });

  it('draws the area as white to the pure hue across and clear to black down, at a fixed aspect, dragged without scrolling', () => {
    const area = ruleFor(`${P} [data-slot="area"]`);
    expect(area).toMatch(/aspect-ratio:\s*var\(--color-picker-area-ratio\)/);
    expect(area).toMatch(/background:\s*var\(--color-picker-shade\), var\(--color-picker-tint\)/);
    expect(area).toMatch(/touch-action:\s*none/);
    expect(ruleFor(P)).toMatch(/--color-picker-area-ratio:\s*\d+ \/ \d+;/);
  });

  it('defines the gradients that name colours in ONE place: the hue circle and the area\'s white and black', () => {
    const root = ruleFor(P);
    expect(root).toMatch(/--color-picker-rainbow:\s*linear-gradient\(to right, red, yellow, lime, cyan, blue, magenta, red\);/);
    expect(root).toMatch(/--color-picker-tint:\s*linear-gradient\(to right, white, var\(--color-picker-hue\)\);/);
    expect(root).toMatch(/--color-picker-shade:\s*linear-gradient\(to top, black, transparent\);/);
    // A colour keyword anywhere else in the picker's rules is a colour literal.
    const KEYWORD = /\b(?:red|yellow|lime|cyan|blue|magenta|white|black)\b/;
    const elsewhere = rules
      .flatMap(([sel, body]) => body.split(';').map((d) => [sel, d.trim()] as const))
      .filter(([, d]) => KEYWORD.test(d) && !/^--color-picker-(?:rainbow|tint|shade):/.test(d));
    expect(elsewhere).toEqual([]);
  });

  it('draws the hue strip on the rainbow, and the slider as the shown colour fading to clear over a checker, each a strip of --slider-track', () => {
    for (const pseudo of ['::-webkit-slider-runnable-track', '::-moz-range-track']) {
      const strip = ruleFor(`${SLIDERS}${pseudo}`);
      expect(strip, pseudo).toMatch(/block-size:\s*var\(--slider-track\)/);
      expect(ruleFor(`${P} [data-slot="hue"]${pseudo}`), pseudo).toMatch(/background:\s*var\(--color-picker-rainbow\)/);
      expect(ruleFor(`${P} [data-slot="opacity"] > input${pseudo}`), pseudo)
        .toMatch(/background:\s*linear-gradient\(to right, var\(--color-picker-current\), transparent\), var\(--checker\)/);
    }
    expect(ruleFor(SLIDERS)).toMatch(/block-size:\s*var\(--slider-track\)/);
    expect(FOUNDATION_CSS).toMatch(/--slider-track:\s*calc\(var\(--u\) \* [\d.]+\);/);
    expect(FOUNDATION_CSS).toMatch(/--checker:\s*repeating-conic-gradient\(/);
  });

  it("the area's thumb is a lens (a hollow ring framing the colour under it); a slider's is a plain filled circle", () => {
    const lens = ruleFor(`${P} [data-slot="area-thumb"]`);
    expect(lens).toMatch(/inline-size:\s*var\(--slider-track\)/);
    expect(lens).toMatch(/block-size:\s*var\(--slider-track\)/);
    expect(lens).toMatch(/border:\s*var\(--ring\) solid var\(--ground-solid\)/);
    expect(lens).toMatch(/box-shadow:\s*0 0 0 var\(--hairline\) var\(--text-1\), inset 0 0 0 var\(--hairline\) var\(--text-1\)/);
    expect(lens).toMatch(/background:\s*transparent/);
    for (const pseudo of ['::-webkit-slider-thumb', '::-moz-range-thumb']) {
      const dot = ruleFor(`${SLIDERS}${pseudo}`);
      expect(dot, pseudo).toMatch(/inline-size:\s*var\(--slider-track\)/);
      expect(dot, pseudo).toMatch(/block-size:\s*var\(--slider-track\)/);
      expect(dot, pseudo).toMatch(/border-radius:\s*var\(--radius-full\)/);
      expect(dot, pseudo).toMatch(/background:\s*var\(--text-1\)/);
      expect(dot, pseudo).toMatch(/border:\s*0/);
      expect(dot, pseudo).not.toMatch(/inset/);
    }
    expect(FOUNDATION_CSS).toMatch(/--hairline:\s*1px;/);
  });

  it('sets the hex in the monospace face, and an invalid hex in the danger colour', () => {
    expect(ruleFor(`${P} [data-slot="hex"]`)).toMatch(/font-family:\s*var\(--font-mono\)/);
    expect(ruleFor(`${P} [data-slot="hex"][aria-invalid="true"]`)).toMatch(/border-color:\s*var\(--danger\)/);
  });

  it('uses tokens only: no length or colour literal in any of its rules', () => {
    const offenders = rules.filter(([, body]) =>
      /\d(?:\.\d+)?(?:(?:px|rem|em|vw|vh)\b|%)|#[0-9a-f]{3,8}\b|\b(?:rgb|rgba|hsl|hsla|oklch|oklab|lab|lch)\(\s*\d/i.test(body));
    expect(offenders.map(([sel]) => sel)).toEqual([]);
  });
});

