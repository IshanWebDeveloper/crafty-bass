'use client';

import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getMe } from '@/lib/api/users';
import { useSession } from '@/lib/auth-client';
import { useSessionStore } from '@/lib/stores/session-store';

/**
 * The signed-in user (id, role, userType, …) or `undefined` when signed out.
 * Used by the header to pick the role-aware nav and CTA. Only fetches once a
 * session exists, and is cached so the nav + actions share a single request.
 *
 * Side effect: mirrors the resolved `userType` into the session store so client
 * components can read the role synchronously (and so sign-up's optimistic set
 * has a home). Resets the store to null when the session goes away.
 */
export function useMe() {
  const { data: session } = useSession();
  const setUserType = useSessionStore((s) => s.setUserType);

  const query = useQuery({
    queryKey: ['me'],
    queryFn: getMe,
    enabled: !!session,
    staleTime: 60_000,
    retry: false,
  });

  useEffect(() => {
    if (!session) {
      setUserType(null);
    } else if (query.data) {
      setUserType(query.data.userType);
    }
  }, [session, query.data, setUserType]);

  return query;
}
