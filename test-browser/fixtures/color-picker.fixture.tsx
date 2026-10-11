// The ColorPicker for the browser test: bundled with Preact and the SDK, it
// opens one picker in a Dropdown's popover (as an app shows it) and reports
// where its parts are laid out, what it committed, and what it shows.
import { render } from 'preact';
import { useState } from 'preact/hooks';
import { installFoundation, oklchToHex, type ColorSwatch, type PopoverVariant } from '../../src/index';
import { Button, ColorPicker, Dropdown } from '../../preact/index';

/** A 50-chip palette: a neutral row, black to white, then a row per tone,
 *  each across ten hues. */
const HUES = [25, 55, 90, 130, 160, 195, 235, 265, 300, 340];
const TONES = [
  { name: 'dark', l: 0.38, c: 0.09 },
  { name: 'deep', l: 0.52, c: 0.15 },
  { name: 'mid', l: 0.7, c: 0.15 },
  { name: 'light', l: 0.88, c: 0.07 },
];
const PALETTE: ColorSwatch[] = [
  ...Array.from({ length: 10 }, (_, i) => {
    const color = oklchToHex({ l: i / 9, c: 0, h: 0 });
    return { id: color, label: `Grey ${i}`, color };
  }),
  ...TONES.flatMap((t) => HUES.map((h) => {
    const color = oklchToHex({ l: t.l, c: t.c, h });
    return { id: color, label: `${h} ${t.name}`, color };
  })),
];
/** A chip whose colour is a token, as an app names its own: read through the page's styles. */
const TOKENED: ColorSwatch = { id: 'tokened', label: 'Tokened', color: 'var(--fixture-colour)' };

type Options = { variant: PopoverVariant; value: string; opacity?: number; tokened?: boolean };

const commits: { value: string[]; opacity: number[] } = { value: [], opacity: [] };

function Harness({ variant, value: initial, opacity: initialOpacity, tokened }: Options) {
  const [value, setValue] = useState(initial);
  const [opacity, setOpacity] = useState(initialOpacity ?? 100);
  return (
    <Dropdown defaultOpen>
      <Dropdown.Trigger>
        <Button variant="quiet" shape="icon" size="sm" label="Colour">c</Button>
      </Dropdown.Trigger>
      <Dropdown.Popover variant={variant}>
        <ColorPicker
          label="Fill colour"
          swatches={tokened ? [TOKENED, ...PALETTE.slice(1)] : PALETTE}
          value={value}
          onValueChange={(v) => { commits.value.push(v); setValue(v); }}
          opacity={initialOpacity === undefined ? undefined : opacity}
          onOpacityChange={initialOpacity === undefined ? undefined : (o) => { commits.opacity.push(o); setOpacity(o); }}
        />
      </Dropdown.Popover>
    </Dropdown>
  );
}

const box = (el: Element | null) => {
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { x: r.x, y: r.y, w: r.width, h: r.height, right: r.right, bottom: r.bottom };
};

(window as unknown as Record<string, unknown>).pickerFixture = {
  palette: PALETTE.map((s) => s.color),
  mount(opts: Options) {
    installFoundation();
    commits.value = [];
    commits.opacity = [];
    document.body.innerHTML = '<style>:root { --fixture-colour: oklch(0.6 0.15 250); }</style><div id="host" style="padding: 24px"></div>';
    render(<Harness {...opts} />, document.getElementById('host')!);
  },
  unmount() { render(null, document.getElementById('host')!); },
  commits: () => ({ value: [...commits.value], opacity: [...commits.opacity] }),
  report() {
    const picker = document.querySelector<HTMLElement>('[data-boogy="color-picker"]')!;
    const sections = [...picker.children] as HTMLElement[];
    const style = (el: Element) => getComputedStyle(el);
    const chips = [...picker.querySelectorAll('[data-slot="swatch"]')];
    const hex = picker.querySelector<HTMLInputElement>('[data-slot="hex"]')!;
    return {
      unit: Number.parseFloat(style(document.documentElement).getPropertyValue('--u')) || 16,
      popover: box(picker.closest('[data-boogy="popover"]')),
      picker: box(picker),
      sections: sections.map((s) => ({
        slot: s.dataset.slot,
        box: box(s),
        padding: [style(s).paddingTop, style(s).paddingRight, style(s).paddingBottom, style(s).paddingLeft].map(Number.parseFloat),
        borderTop: Number.parseFloat(style(s).borderTopWidth),
        borderTopColor: style(s).borderTopColor,
      })),
      chips: chips.map(box),
      chipRadius: Number.parseFloat(style(chips[0]).borderTopLeftRadius),
      area: box(picker.querySelector('[data-slot="area"]')),
      thumb: box(picker.querySelector('[data-slot="area-thumb"]')),
      hue: box(picker.querySelector('[data-slot="hue"]')),
      preview: box(picker.querySelector('[data-slot="preview"]')),
      hex: box(hex),
      hexValue: hex.value,
      hexSpellcheck: hex.getAttribute('spellcheck'),
      slider: box(picker.querySelector('[data-slot="opacity"] input')),
      sliderValue: picker.querySelector<HTMLInputElement>('[data-slot="opacity"] input')?.value ?? null,
      areaBackground: style(picker.querySelector('[data-slot="area"]')!).backgroundImage,
      hueTrack: style(picker).getPropertyValue('--color-picker-rainbow'),
      focused: (document.activeElement as HTMLElement | null)?.dataset.slot ?? null,
    };
  },
};
