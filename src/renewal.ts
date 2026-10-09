// Staying signed in on the app's own address: on an unauthenticated failure,
// renew the session once (the page's renewal cookie for a fresh session, with
// no page change), then try once more. Pure: the caller supplies the request,
// the renewal and the test for "unauthenticated".

/** Run `attempt`. If it fails unauthenticated, renew once and run it once
 *  more. A renewal that fails, or a second unauthenticated failure, is
 *  rethrown as it is. */
export async function withRenewal<T>(
  attempt: () => Promise<T>,
  renew: () => Promise<boolean>,
  isUnauthenticated: (e: unknown) => boolean,
): Promise<T> {
  try {
    return await attempt();
  } catch (e) {
    if (!isUnauthenticated(e) || !(await renew())) throw e;
    return attempt();
  }
}

/** Read the session. If it is signed out, renew once and read again. */
export async function sessionOrRenewed<S>(read: () => Promise<S | null>, renew: () => Promise<boolean>): Promise<S | null> {
  const session = await read();
  if (session !== null || !(await renew())) return session;
  return read();
}
