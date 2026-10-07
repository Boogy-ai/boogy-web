/** Options passed to the `Boogy` constructor. */
export interface BoogyOptions {
  /**
   * How the SDK drives the install flow (`install`): in a popup window, or by
   * navigating the whole page. Defaults to `'popup'`. Sign-in is always the
   * platform's, so it does not read this.
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
