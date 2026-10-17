// The markdown renderer over the vendored marked and DOMPurify, as the host
// serves them, for a real browser to run.
import { markdownRenderer, type HtmlSanitiser, type MarkdownParser } from '../../src/components/markdown';
import { marked } from '../../vendor/marked-18.0.14.js';
import purify from '../../vendor/dompurify-3.4.16.js';

const render = markdownRenderer(marked as unknown as MarkdownParser, purify as unknown as HtmlSanitiser);
(window as unknown as Record<string, unknown>).markdownFixture = { render, supported: (purify as unknown as HtmlSanitiser).isSupported };
