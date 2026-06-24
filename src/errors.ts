/**
 * All errors thrown by the SDK are instances of BoogyError.
 * Discriminate on `code` to handle specific failure modes.
 */
export class BoogyError extends Error {
  readonly code:
    | 'sign_in_aborted'
    | 'consent_denied'
    | 'popup_blocked'
    | 'app_not_found'
    | 'network';

  /** The `owner/service` app identifier, when the error is app-specific. */
  readonly app?: string;

  constructor(
    code: BoogyError['code'],
    message: string,
    app?: string,
  ) {
    super(message);
    this.name = 'BoogyError';
    this.code = code;
    this.app = app;

    // Restore prototype chain (required when extending built-ins in ES5 targets).
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
