/**
 * PKCE (RFC 7636) helpers and CSRF state generation.
 * Uses Web Crypto exclusively — no external dependencies.
 */

/** Encode a Uint8Array as base64url without padding. */
function toBase64UrlNoPad(bytes: Uint8Array): string {
  // Convert bytes to a binary string for btoa
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Generate a random PKCE code verifier.
 * Returns a base64url-no-pad string of at least 43 characters (32+ random bytes).
 */
export function randomVerifier(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return toBase64UrlNoPad(bytes);
}

/**
 * Compute the S256 code challenge for a given verifier.
 * Returns base64url-no-pad(sha256(verifier)) — matches the server-side PKCE verify.
 */
export async function s256Challenge(verifier: string): Promise<string> {
  const encoded = new TextEncoder().encode(verifier);
  const hashBuffer = await crypto.subtle.digest('SHA-256', encoded);
  return toBase64UrlNoPad(new Uint8Array(hashBuffer));
}

/**
 * Generate a random opaque CSRF state token.
 * Returns a base64url-no-pad string.
 */
export function randomState(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return toBase64UrlNoPad(bytes);
}
