'use client';

import { useSyncExternalStore } from 'react';

const emptySubscribe = () => () => {};

/**
 * `true` only after the component has mounted on the client. Gate UI that
 * depends on client-only data (e.g. the better-auth session, which is absent
 * during SSR but can resolve synchronously on the client) so the first client
 * render matches the server HTML and avoids hydration mismatches.
 *
 * Implemented with `useSyncExternalStore`: the server snapshot is `false` (used
 * for SSR and the hydration render), and the client snapshot is `true`, so the
 * value flips to `true` immediately after hydration.
 */
export function useMounted(): boolean {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );
}
