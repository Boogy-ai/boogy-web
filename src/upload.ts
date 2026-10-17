// uploadFile: a file's bytes sent to the platform with the ticket the app's
// service minted for it (`files_create_upload`): the bytes go from the
// browser to the platform, never through the service. The ticket's url is
// opaque; it is used as given. A refusal says why in words a person can act on.
export interface UploadTicket {
  url: string;
  method: string;
}

const REFUSALS: Record<number, string> = {
  413: 'That file is too large.',
  415: 'That kind of file is not accepted.',
  507: 'There is no room left to store it.',
};

export async function uploadFile(ticket: UploadTicket, file: Blob, fetcher: typeof fetch = (...a) => fetch(...a)): Promise<void> {
  const r = await fetcher(ticket.url, {
    method: ticket.method,
    body: file,
    headers: file.type ? { 'content-type': file.type } : {},
    credentials: 'same-origin',
  });
  if (!r.ok) throw new Error(REFUSALS[r.status] ?? `The upload failed (${r.status}).`);
}
