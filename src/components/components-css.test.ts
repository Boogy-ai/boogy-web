import { describe, it, expect } from 'vitest';
import { COMPONENTS_CSS } from './components-css';

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
    expect(body).toMatch(/background:\s*var\(--drawer-edge\)/);
    expect(body).toMatch(/cursor:\s*col-resize/);
    expect(ruleFor('[data-boogy="drawer-resizer"]:is(:hover, :focus-visible, [data-active="true"])')).toMatch(/background:\s*var\(--drawer-edge-hover\)/);
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
