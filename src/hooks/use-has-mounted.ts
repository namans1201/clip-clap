'use client';

import { useSyncExternalStore } from 'react';

const emptySubscribe = () => () => {};

/**
 * True only after the client has hydrated. Needed for anything that reads
 * next-themes' resolvedTheme (or otherwise differs between server and
 * client render) to avoid a hydration mismatch.
 *
 * Implemented with useSyncExternalStore rather than `useState` + a
 * `useEffect(() => setMounted(true), [])` — the effect version calls
 * setState synchronously from within an effect, which schedules a second,
 * avoidable render pass. useSyncExternalStore's getServerSnapshot/getSnapshot
 * split is exactly for "differs between server and client" and needs no
 * extra render or effect to do it.
 */
export function useHasMounted() {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );
}
