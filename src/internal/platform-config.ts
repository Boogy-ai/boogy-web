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
   * origin. A pane must be TOLD this rather than infer it. Empty when no
   * shell is designated, which is the default.
   */
  shellOrigins: string[];
  /**
   * How ANY owner's apps are addressed: an absolute origin with one literal
   * `{owner}` where the owner's handle goes, e.g.
   * `https://{owner}.boogy.app`. The platform publishes it whole — scheme,
   * base domain and port — so a page never composes an app origin out of its
   * own `location`. Absent when the platform serves no owner subdomains.
   *
   * `owner` above is THIS origin's owner. On a board shell that is the
   * shell's, and the apps it frames are usually someone else's: this is how
   * the page relates those apps' origins to their owner.
   */
  appOriginTemplate?: string;
}

/** The placeholder `appOriginTemplate` carries where an owner handle goes. */
export const OWNER_PLACEHOLDER = '{owner}';

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

  const { authOrigin, owner, shellOrigins, appOriginTemplate } = body as {
    authOrigin?: unknown;
    owner?: unknown;
    shellOrigins?: unknown;
    appOriginTemplate?: unknown;
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

  const config: PlatformConfig = { authOrigin: authOrigin.replace(/\/+$/, ''), owner, shellOrigins: origins };
  if (usableTemplate(appOriginTemplate)) config.appOriginTemplate = appOriginTemplate;
  return config;
}

/**
 * Whether `value` is a template this SDK can substitute: an absolute http(s)
 * origin carrying the placeholder exactly once. Anything else is dropped
 * rather than half-used — a template that cannot be matched both ways would
 * name the wrong owner, and naming no owner refuses honestly instead.
 */
function usableTemplate(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  if (!/^https?:\/\//i.test(value)) return false;
  return value.split(OWNER_PLACEHOLDER).length === 2;
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
