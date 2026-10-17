// A message with links in a bubble of a given width, its previews read from
// whatever the test's network answers for /boogy/preview.
import { render } from 'preact';
import { Bubble, FencedText } from '../../preact/index';
import { installFoundation, loadLinkFinder, type LinkFinder } from '@boogy/web';
import * as linkify from '../../vendor/linkify-4.3.3.js';

(window as unknown as Record<string, unknown>).previewFixture = {
  async mount(text: string, width: number) {
    installFoundation();
    await loadLinkFinder(async () => linkify as unknown as LinkFinder);
    const root = document.createElement('div');
    root.id = 'R';
    root.style.width = `${width}px`;
    document.body.appendChild(root);
    render(<Bubble><FencedText text={text} /></Bubble>, root);
  },
};
