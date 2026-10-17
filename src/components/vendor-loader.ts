// A script the host serves at /boogy/vendor/ (a highlighter, a markdown
// parser), loaded once for the page the first time something needs it. Every
// asker shares the one load; a failed load is forgotten, so the next asker
// tries again.

export interface VendorLoader<T> {
  /** The script's export, loading it if no one has (by `custom`, for a test). */
  load(custom?: () => Promise<T>): Promise<T>;
  /** The export, if the page has loaded it already. */
  loaded(): T | null;
}

export function vendorLoader<T>(defaultLoad: () => Promise<T>): VendorLoader<T> {
  let pending: Promise<T> | null = null;
  let ready: T | null = null;
  return {
    load(custom = defaultLoad) {
      if (!pending) {
        pending = custom().then(
          (value) => { ready = value; return value; },
          (err: unknown) => { pending = null; throw err; },
        );
      }
      return pending;
    },
    loaded: () => ready,
  };
}

/** The module at `path`, which the host serves apart from the SDK's bundle:
 *  taken as a variable, so no bundler tries to follow it. */
export async function importVendor<M>(path: string): Promise<M> {
  return (await import(/* @vite-ignore */ path)) as M;
}
