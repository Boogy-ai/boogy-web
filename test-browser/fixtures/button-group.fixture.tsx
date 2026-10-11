// The ZoomControls and a rounded ButtonGroup of two soft icon buttons, for the
// browser test: bundled with Preact and the SDK, mounted on a ground.
import { render } from 'preact';
import { installFoundation } from '../../src/index';
import { Button, ButtonGroup, Glyph, ZoomControls } from '../../preact/index';

(window as unknown as Record<string, unknown>).buttonGroupFixture = {
  mount() {
    installFoundation();
    document.body.innerHTML = '<div id="host" style="display:flex;gap:32px;align-items:center;padding:24px;width:max-content"></div>';
    render(
      <>
        <ZoomControls value={1} onValueChange={() => {}} />
        <ButtonGroup label="History" rounded>
          <Button variant="soft" shape="icon" label="Back"><Glyph shape="back" /></Button>
          <Button variant="soft" shape="icon" label="Forward"><Glyph shape="forward" /></Button>
        </ButtonGroup>
        <ButtonGroup label="Plain">
          <Button variant="soft" shape="icon" label="One"><Glyph shape="back" /></Button>
          <Button variant="soft" shape="icon" label="Two"><Glyph shape="forward" /></Button>
        </ButtonGroup>
      </>,
      document.getElementById('host')!,
    );
  },
  report() {
    const px = (el: Element, p: string) => getComputedStyle(el).getPropertyValue(p);
    const groups = [...document.querySelectorAll('[data-boogy="button-group"]')];
    const radii = (el: Element) => ['border-top-left-radius', 'border-top-right-radius', 'border-bottom-right-radius', 'border-bottom-left-radius'].map((p) => parseFloat(px(el, p)));
    const unit = parseFloat(px(document.documentElement, '--u'));
    return {
      unit,
      groups: groups.map((g) => {
        const [a, b] = [...g.children];
        const ra = a.getBoundingClientRect(); const rb = b.getBoundingClientRect();
        return {
          a: radii(a), b: radii(b), aHeight: ra.height,
          gap: rb.left - ra.right,
          seamA: parseFloat(px(a, 'border-inline-start-width')), seamB: parseFloat(px(b, 'border-inline-start-width')),
          seamColor: px(b, 'border-inline-start-color'),
          overflow: px(g, 'overflow'),
        };
      }),
      zoomGlyphs: [...document.querySelectorAll('[data-boogy="zoom-controls"] svg')].map((s) => s.getBoundingClientRect().width),
      iconMd: parseFloat(px(document.documentElement, '--icon-md')) || null,
      zoomLetters: document.querySelectorAll('[data-slot="letter"]').length,
    };
  },
};
