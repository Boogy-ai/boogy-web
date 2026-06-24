/** Options passed to the `Boogy` constructor. */
export interface BoogyOptions {
  /**
   * The platform base URL (e.g. `https://boogy.ai`).
   * The SDK derives app origins and the auth origin from this value.
   */
  host: string;

  /**
   * How the SDK drives the sign-in and consent flows.
   * Defaults to `'popup'`.
   */
  authMode?: 'popup' | 'redirect';
}

/** The end-user currently authenticated on the given app. */
export interface CurrentUser {
  /** Pairwise identifier — stable per (user, app) pair, opaque to third parties. */
  pairwiseId: string;
  /**
   * ISO-8601 timestamp of when the user first connected this app. Optional: the
   * server omits it when the underlying grant record is unavailable.
   */
  connectedAt?: string;
}

/** An end-user's consent grant for a specific app. */
export interface Grant {
  /** The `owner/service` app identifier. */
  app: string;
  /** ISO-8601 timestamp of when the grant was first issued. */
  connectedAt: string;
  /**
   * ISO-8601 timestamp of the most recent use of this grant. Optional: absent
   * until the grant has been used at least once.
   */
  lastUsedAt?: string;
}
