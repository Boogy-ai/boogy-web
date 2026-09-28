import { render } from 'preact';
import { installFoundation, scale, surface } from '@boogy/web';

installFoundation();

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
