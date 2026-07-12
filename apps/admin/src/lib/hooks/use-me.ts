'use client';

import { useQuery } from '@tanstack/react-query';
import { getMe } from '../api/users';
import { useSession } from '../auth-client';

// The signed-in user (id, role, userType, …) or `undefined` when signed out.
// The admin guard reads `role` from here to decide access. Only fetches once a
// session exists, and is cached so the guard and any future role-aware UI share
// a single request.
export function useMe() {
  const { data: session } = useSession();
  return useQuery({
    queryKey: ['me'],
    queryFn: getMe,
    enabled: !!session,
    staleTime: 60_000,
    retry: false,
  });
}
