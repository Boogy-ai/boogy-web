import { render } from 'preact';
import { connectPane, installFoundation, scale, surface } from '@boogy/web';

// The page scale is on by default: every SDK size follows the window, or the
// pane in a board.
installFoundation();
// In a board: its background, colour scheme and Smaller/Larger reach the page.
connectPane({ service: '{{name}}' });

// Each region declares how it scales. This header's text shares a line with
// other content, so it is `clamped`; it follows the scarce axis (`min`).
const HEADER = scale({ axis: 'min', policy: 'clamped', factor: 4, floor: '0.75rem', cap: '1.125rem', component: 'Header' });

function App() {
  return (
    <main {...surface('both')} class="app">
      <header {...HEADER} class="header">
        <h1>{{name}}</h1>
      </header>
    </main>
  );
}

render(<App />, document.getElementById('app')!);
