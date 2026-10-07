// Whether a path a pane REPORTED may be used as that pane's iframe `src`.
//
// The shell stores this and navigates to it on a later mount, so an
// unvalidated value is an open redirect that persists. The path is resolved
// the way a browser will resolve it, and accepted only if resolving it changes
// nothing: a browser reads `/\host` like `//host`, resolves `%2e%2e` as `..`,
// and silently drops tabs and newlines, and each of those is a way to make a
// path mean something other than it looks.

const PROBE = 'https://pane.invalid';
/** The longest location a board saves; a platform board refuses longer ones. */
const MAX_PATH = 2048;

export function isRestorablePath(path: string): boolean {
  if (path.length > MAX_PATH) return false;
  if (!path.startsWith('/') || path.startsWith('//') || path.includes('\\')) return false;
  let url: URL;
  try {
    url = new URL(path, PROBE);
  } catch {
    return false;
  }
  if (url.origin !== PROBE) return false;
  // Anything the parser rewrote (dot segments, encoded dots, dropped
  // characters) is refused rather than normalised.
  if (`${url.pathname}${url.search}${url.hash}` !== path) return false;
  if (url.pathname.split('/').some((seg) => /^(\.|%2e){1,2}$/i.test(seg))) return false;
  return true;
}
