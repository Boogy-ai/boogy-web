/**
 * Cookie helpers for the Boogy PKCE flow.
 */

/**
 * Write the PKCE code verifier into a short-lived, path-scoped cookie.
 * Attributes: Secure; SameSite=Lax; Path=/boogy/callback; Max-Age=300
 */
export function setPkceCookie(verifier: string): void {
  document.cookie = `boogy_pkce=${verifier}; Secure; SameSite=Lax; Path=/boogy/callback; Max-Age=300`;
}
