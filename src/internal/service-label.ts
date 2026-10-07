// The shape of a service's own label — the first DNS label of the address
// every app is served at (`notes-k3v9` in `https://notes-k3v9.boogy.app`).

/** Lowercase `[a-z0-9]` words joined by single hyphens, the last word the 3–6
 *  character suffix the platform draws. Never `--`, never an edge hyphen. */
const SERVICE_LABEL = /^[a-z0-9]+(?:-[a-z0-9]+)*-[a-z0-9]{3,6}$/;

/** Whether `label` has a service label's shape — checked before an origin is
 *  composed out of a label, so a value that is not one is refused rather than
 *  turned into some other host.
 *
 *  A shape, not a lookup: it says nothing about whether any app holds the
 *  label. Most platform labels (`boards`, `auth`) are one hyphen-free word and
 *  never match; one, `security-txt`, does have this shape, and the platform
 *  never allocates it to an app — which no shape check can see. */
export function isServiceLabel(label: string): boolean {
  return label.length <= 63 && SERVICE_LABEL.test(label);
}
