// Whether a picture should show: there is one, and it has not failed to load.
// A new `src` gets a fresh try. Returns that, and the handler for the img's
// error event.
import { useEffect, useState } from 'preact/hooks';

export function usePicture(src: string | undefined): [show: boolean, onError: () => void] {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);
  return [Boolean(src) && !failed, () => setFailed(true)];
}
