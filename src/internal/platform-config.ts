import { BoogyError } from '../errors';

/**
 * What the platform tells this deployment about the origin it is served on.
 *
 * Read from `GET /boogy/config`, never derived from the current hostname —
 * a hostname label is not always the owner handle (a platform-designated
 * origin is the sharp case), and the auth origin lives on a different
 * registrable domain in production than in local development. Guessing
 * either from the URL bar is exactly the class of bug this module exists to
 * remove.
 */
export interface PlatformConfig {
  /** Where `/authorize` is served, e.g. `https://auth.boogy.ai`. No trailing slash. */
  authOrigin: string;
  /**
   * The owner handle whose services this origin serves — the `<owner>` in
   * `boogy://<owner>/services/<id>`. NOT the first label of the hostname.
   */
  owner: string;
  /**
   * The origins of the platform shells that may frame a deployment at this
   * origin: the framers this origin's own policy admits. A pane must be TOLD
   * this rather than infer it. Empty when nothing may frame it, which is also
   * the case on the board shell itself (see `boardShell`).
   */
  shellOrigins: string[];
  /**
   * The one service this origin serves, where it serves exactly one: a
   * service's own address (its label, e.g. `https://notes-k3v9.boogy.app`), a
   * verified custom domain bound to it, or a designated reserved label such as
   * the boards origin. Absent where no single service is served. A page with
   * it is on its app's own origin, and no other app is served there.
   */
  service?: string;
  /**
   * Whether this origin is the platform's board shell: the boards origin, where
   * a board signs its apps in. `true` there and `false` everywhere else,
   * including Boards served at any other address.
   *
   * Not `shellOrigins`: that lists who may frame this origin, and the boards
   * origin lets nothing frame it, so it is empty there.
   */
  boardShell: boolean;
  /** `'board'` when this app declared that, in a board, it shows the board's
   *  background. Absent otherwise. */
  boardBackground?: 'board';
}

const CONFIG_PATH = '/boogy/config';

let cached: PlatformConfig | null = null;
// The in-flight load, so two callers racing ahead of the first resolution
// share one fetch instead of each starting their own. Cleared on BOTH
// settle paths (see `loadPlatformConfig` below) — in particular on
// rejection, so a transient failure never pins itself as a permanent one:
// only a resolved value is ever promoted to `cached`.
let inFlight: Promise<PlatformConfig> | null = null;

/**
 * Validate one `/boogy/config` response body. Pure, and exported so the wire
 * contract can be checked without a network call — a rename on either end
 * breaks it here.
 */
export function parsePlatformConfig(body: unknown): PlatformConfig {
  if (typeof body !== 'object' || body === null) {
    throw new BoogyError('config_unavailable', 'the platform config response was not an object');
  }

  const { authOrigin, owner, shellOrigins, service, boardShell, boardBackground } = body as {
    authOrigin?: unknown;
    owner?: unknown;
    shellOrigins?: unknown;
    service?: unknown;
    boardShell?: unknown;
    boardBackground?: unknown;
  };

  if (typeof owner !== 'string' || !owner) {
    throw new BoogyError('config_unavailable', 'the platform config response had no owner handle');
  }
  if (
    typeof authOrigin !== 'string' ||
    !(authOrigin.startsWith('https://') || authOrigin.startsWith('http://'))
  ) {
    throw new BoogyError(
      'config_unavailable',
      'the platform config response had no absolute auth origin',
    );
  }

  const origins = Array.isArray(shellOrigins)
    ? shellOrigins.filter((o): o is string => typeof o === 'string')
    : [];

  const config: PlatformConfig = {
    authOrigin: authOrigin.replace(/\/+$/, ''),
    owner,
    shellOrigins: origins,
    // Only a literal `true` is a yes: anything else, or nothing, is no.
    boardShell: boardShell === true,
  };
  if (typeof service === 'string' && service) config.service = service;
  if (boardBackground === 'board') config.boardBackground = 'board';
  return config;
}

/** The actual fetch-and-parse, factored out so `loadPlatformConfig` can wrap it in single-flight. */
async function fetchPlatformConfig(): Promise<PlatformConfig> {
  let res: Response;
  try {
    res = await globalThis.fetch(CONFIG_PATH, { credentials: 'same-origin' });
  } catch (e) {
    throw new BoogyError(
      'config_unavailable',
      e instanceof Error ? e.message : 'the platform config request failed',
    );
  }

  if (!res.ok) {
    throw new BoogyError('config_unavailable', `the platform answered ${res.status}`);
  }

  let body: unknown;
  try {
    body = await res.json();
  } catch {
    throw new BoogyError('config_unavailable', 'the platform config response was not JSON');
  }

  return parsePlatformConfig(body);
}

/**
 * Fetch `GET /boogy/config` at this origin's root — not under any service
 * mount — and cache the result. A later call is served from the cache with
 * no further fetch, so callers may call this freely without worrying about
 * repeat network round-trips.
 *
 * Single-flight: two calls made before the first resolves share the same
 * underlying fetch rather than each starting their own.
 *
 * Throws rather than degrading: a missing or unreachable config must surface
 * as an error the caller can see, never a silent guess at the auth origin or
 * owner. A failed call is NOT cached — the in-flight promise is cleared on
 * rejection too, so a later call genuinely retries rather than replaying the
 * same failure forever.
 */
export function loadPlatformConfig(): Promise<PlatformConfig> {
  if (cached) return Promise.resolve(cached);
  if (!inFlight) {
    inFlight = fetchPlatformConfig().then(
      (config) => {
        cached = config;
        inFlight = null;
        return config;
      },
      (err: unknown) => {
        inFlight = null;
        throw err;
      },
    );
  }
  return inFlight;
}

/**
 * The cached config from a prior `loadPlatformConfig()` call. Throws — never
 * a default — if it was never loaded.
 */
export function platformConfig(): PlatformConfig {
  if (!cached) {
    throw new BoogyError(
      'config_unavailable',
      'platform config was never loaded — call loadPlatformConfig() first',
    );
  }
  return cached;
}
