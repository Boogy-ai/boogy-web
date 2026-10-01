import { describe, it, expect } from 'vitest';
import { COMPONENTS_CSS } from './components-css';
import { FOUNDATION_CSS } from '../layout/foundation-css';

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

// The rule body for a selector, from the code (comments stripped). Null when absent.
function ruleFor(selector: string): string | null {
  const at = CODE.indexOf(`${selector} {`);
  if (at < 0) return null;
  return CODE.slice(at, CODE.indexOf('}', at));
}

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
  it('page: the whole screen, a head and a scrolling body', () => {
    const page = ruleFor('[data-boogy="popover"][data-mode="page"]')!;
    expect(page).toMatch(/inset:\s*0/);
    expect(page).toMatch(/width:\s*100%/);
    expect(page).toMatch(/height:\s*100%/);
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
    expect(ruleFor('[data-boogy="menu-item"]')).toContain('grid-template-columns: 1fr auto auto');
  });
});

describe('tabs', () => {
  it('a row of tabs on a hairline, the selected one in the full ink with the accent under it', () => {
    expect(ruleFor('[data-boogy="tabs"] > [data-slot="list"]')).toContain('border-bottom: 1px solid var(--edge)');
    const t = ruleFor('[data-boogy="tabs"] [data-slot="tab"]')!;
    expect(t).toContain('color: var(--text-2)');
    expect(t).toContain('border-bottom: var(--ring) solid transparent');
    const on = ruleFor('[data-boogy="tabs"] [data-slot="tab"][aria-selected="true"]')!;
    expect(on).toContain('color: var(--text-1)');
    expect(on).toContain('border-bottom-color: var(--accent)');
  });
});
