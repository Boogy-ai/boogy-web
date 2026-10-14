import type { Plugin } from 'vite';
import { boogyDev, type BoogyDevOptions } from './plugin.js';
import { isSdkCssModule, minifyCssLiterals } from './css-minify.js';

/**
 * The Vite setup a Boogy frontend needs, as plugins an app spreads next to its
 * own: `plugins: [preact(), ...boogyVite(dev)]`. Upgrading `@boogy/web`
 * upgrades this; the app's config stays its own.
 *
 * - Relative asset paths (`base: './'`): the platform injects the right
 *   `<base href>` at serve time, so one build works wherever it is served. An explicit
 *   `base` in the app's own config still wins.
 * - The local dev platform (`boogyDev`), active under `vite` only.
 * - In a build, the SDK's own stylesheets minified: they are CSS inside
 *   template strings, which a JavaScript minifier leaves as written, comments
 *   and all (`css-minify.ts`).
 */
export function boogyVite(dev: BoogyDevOptions): Plugin[] {
  return [
    {
      name: 'boogy-base',
      config(user) {
        return user.base === undefined ? { base: './' } : {};
      },
    },
    boogyDev(dev),
    {
      name: 'boogy-sdk-css',
      apply: 'build',
      transform(code, id) {
        return isSdkCssModule(id) ? { code: minifyCssLiterals(code), map: null } : null;
      },
    },
  ];
}
