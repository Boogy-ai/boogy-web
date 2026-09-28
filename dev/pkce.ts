import { createHash } from 'node:crypto';

/** S256: base64url(sha256(verifier)) must equal the challenge. */
export function verifyS256(verifier: string, challenge: string): boolean {
  return createHash('sha256').update(verifier).digest('base64url') === challenge;
}
