/**
 * Cookie helpers for the Boogy PKCE flow.
 */

/**
 * Write the PKCE code verifier into a short-lived cookie on this origin, for
 * the platform's sign-in callback here to read.
 *
 * `__Host-`, so no other host — not even a sibling subdomain on the same site —
 * can set a cookie under this name, and so none can plant a verifier of its own
 * and sign the person in as someone else. The browser keeps a `__Host-` cookie
 * only with `Secure`, no `Domain` and `Path=/` exactly, hence the path.
 * Attributes: Secure; SameSite=Lax; Path=/; Max-Age=300
 */
export function setPkceCookie(verifier: string): void {
  document.cookie = `__Host-boogy_pkce=${verifier}; Secure; SameSite=Lax; Path=/; Max-Age=300`;
}
