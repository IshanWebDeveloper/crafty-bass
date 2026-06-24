'use client';

import { useQuery } from '@tanstack/react-query';
import { getMe } from '@/lib/api/users';
import { useSession } from '@/lib/auth-client';

/**
 * The signed-in user (id, role, userType, …) or `undefined` when signed out.
 * Used by the header to pick the role-aware nav and CTA. Only fetches once a
 * session exists, and is cached so the nav + actions share a single request.
 */
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
