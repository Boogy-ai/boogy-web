/** Options passed to the `Boogy` constructor. */
export interface BoogyOptions {
  /**
   * How the SDK drives the sign-in and consent flows.
   * Defaults to `'popup'`.
   */
  authMode?: 'popup' | 'redirect';

  /**
   * Extra app audiences to include when `Boogy.fetch` silently re-authorizes
   * after a `401`, alongside the audience of the app whose request failed.
   *
   * Called fresh on every renewal attempt, so a caller whose set of open
   * apps changes over time (e.g. panes added or removed on a multi-app page)
   * stays covered without going stale — one consent round-trip renews every
   * app that's currently in play, instead of prompting once per app as each
   * one's session happens to expire.
   *
   * Omit this for a single-app page: the failing app's own audience is
   * always included regardless.
   */
  renewAudiences?: () => readonly string[];
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
  /** The services this origin's session covers, as ids under the app's owner. */
  services: string[];
  /**
   * The name to show for the person: the profile name they chose to share with
   * this app, else their handle when this app is entitled to it (always for the
   * person's own app; otherwise only with their consent to share their
   * identity). `null` when neither applies.
   */
  displayName: string | null;
  /**
   * The person's handle, when this app is entitled to it — always for the
   * person's own app, otherwise only with their consent to share their
   * identity. `null` otherwise.
   */
  handle: string | null;
  /** The person's avatar URL, when they chose to share it. */
  avatarUrl: string | null;
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
