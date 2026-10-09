// The ColumnChart for the browser test: bundled with Preact and the SDK, it
// mounts one chart, as an app renders it, in a box of a given width.
import { render } from 'preact';
import { installFoundation } from '../../src/index';
import { ColumnChart } from '../../preact/index';

const columns = Array.from({ length: 12 }, (_, i) => ({
  label: `10:${String(i * 5).padStart(2, '0')}`,
  segments: [
    { value: (i * 7) % 5 + 1, color: 'oklch(60% 0.15 250)', label: 'signed in' },
    { value: (i * 3) % 4, color: 'oklch(60% 0.15 250)', label: 'by link', pattern: 'stripes' as const },
  ],
}));

(window as unknown as Record<string, unknown>).columnChartFixture = {
  mount(width: number, series: typeof columns = columns) {
    installFoundation();
    document.body.innerHTML = `<div id="host" style="width:${width}px;padding:16px;background:white"></div>`;
    render(
      <ColumnChart caption="Values over time, a caption long enough to be seen if it is drawn" labelHeader="Time" startLabel="10:00" endLabel="10:55" columns={series} />,
      document.getElementById('host')!,
    );
  },
};
