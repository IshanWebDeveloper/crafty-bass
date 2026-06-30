'use client';

import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSession } from '@/lib/auth-client';
import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type ApiNotification,
} from '@/lib/api/notifications';
import {
  toAppNotification,
  type AppNotification,
} from '@/components/notifications/notifications-data';

const QUERY_KEY = ['notifications'] as const;

/**
 * The signed-in user's notifications, shaped for the bell + centre. Both surfaces
 * share this one query so they stay in sync and issue a single request. Marking
 * read is optimistic (instant badge update) with rollback + invalidate on settle.
 * Returns an empty list when signed out (the query stays disabled).
 */
export function useNotifications(locale: string) {
  const { data: session } = useSession();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: QUERY_KEY,
    queryFn: listNotifications,
    enabled: !!session,
    staleTime: 30_000,
  });

  const items: AppNotification[] = useMemo(
    () => (query.data ?? []).map((n) => toAppNotification(n, locale)),
    [query.data, locale],
  );
  const unread = useMemo(() => items.filter((n) => n.unread).length, [items]);

  const patchCache = (shouldRead: (n: ApiNotification) => boolean) =>
    queryClient.setQueryData<ApiNotification[]>(QUERY_KEY, (prev) =>
      prev?.map((n) => (shouldRead(n) ? { ...n, read: true } : n)),
    );

  const readOneMutation = useMutation({
    mutationFn: markNotificationRead,
    onMutate: async (id: string) => {
      await queryClient.cancelQueries({ queryKey: QUERY_KEY });
      const previous = queryClient.getQueryData<ApiNotification[]>(QUERY_KEY);
      patchCache((n) => n.id === id);
      return { previous };
    },
    onError: (_error, _id, context) => {
      if (context?.previous) {
        queryClient.setQueryData(QUERY_KEY, context.previous);
      }
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  });

  const readAllMutation = useMutation({
    mutationFn: markAllNotificationsRead,
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: QUERY_KEY });
      const previous = queryClient.getQueryData<ApiNotification[]>(QUERY_KEY);
      patchCache(() => true);
      return { previous };
    },
    onError: (_error, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(QUERY_KEY, context.previous);
      }
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  });

  return {
    items,
    unread,
    isLoading: query.isLoading,
    readOne: (id: string) => readOneMutation.mutate(id),
    markAll: () => readAllMutation.mutate(),
  };
}
