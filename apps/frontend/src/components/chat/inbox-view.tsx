'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Avatar, AvatarFallback, AvatarImage, Skeleton } from '@repo/ui';
import { Card, CardContent } from '@/components/ui/card';
import { listMyConversations } from '@/lib/api/conversations';
import { useSession } from '@/lib/auth-client';
import type { Locale } from '@/i18n/config';
import type { Dictionary } from '@/i18n/dictionaries';

export function InboxView({
  locale,
  dict,
}: {
  locale: Locale;
  dict: Dictionary;
}) {
  const { data: session } = useSession();
  const t = dict.chat.inbox;

  const { data, isLoading } = useQuery({
    queryKey: ['conversations'],
    queryFn: listMyConversations,
    refetchInterval: 10_000,
  });

  if (isLoading || !session) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-20 rounded-xl" />
        ))}
      </div>
    );
  }

  if (!data || data.data.length === 0) {
    return (
      <Card>
        <CardContent className="p-10 text-center text-sm text-muted-foreground">
          {t.empty}
        </CardContent>
      </Card>
    );
  }

  const currentUserId = session.user.id;

  return (
    <ul className="space-y-3">
      {data.data.map((c) => {
        const other = c.participants.find((p) => p.userId !== currentUserId);
        const lastMessage = c.messages[0];
        const initials =
          other?.user.name
            .split(' ')
            .map((p) => p[0])
            .filter(Boolean)
            .slice(0, 2)
            .join('')
            .toUpperCase() ?? '?';
        const unread = !!(
          lastMessage &&
          lastMessage.senderId !== currentUserId &&
          c.participants.find((p) => p.userId === currentUserId)?.lastReadAt &&
          new Date(
            c.participants.find((p) => p.userId === currentUserId)
              ?.lastReadAt ?? 0,
          ) < new Date(lastMessage.createdAt)
        );

        return (
          <li key={c.id}>
            <Link href={`/${locale}/messages/${c.id}`}>
              <Card className="cursor-pointer transition-all hover:shadow-card hover:ring-foreground/20">
                <CardContent className="flex items-center gap-3 p-4">
                  <Avatar className="h-10 w-10">
                    {other?.user.image ? (
                      <AvatarImage
                        src={other.user.image}
                        alt={other.user.name}
                      />
                    ) : null}
                    <AvatarFallback>{initials}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-sm font-medium">
                        {other?.user.name ?? '-'}
                      </p>
                      <p className="shrink-0 text-xs text-muted-foreground">
                        {c.lastMessageAt
                          ? new Date(c.lastMessageAt).toLocaleString(locale, {
                              hour: '2-digit',
                              minute: '2-digit',
                              month: 'short',
                              day: 'numeric',
                            })
                          : ''}
                      </p>
                    </div>
                    {c.job ? (
                      <p className="truncate text-xs text-muted-foreground">
                        {t.openJob.replace('{title}', c.job.title)}
                      </p>
                    ) : null}
                    {lastMessage ? (
                      <p
                        className={
                          'truncate text-sm ' +
                          (unread
                            ? 'font-medium text-foreground'
                            : 'text-muted-foreground')
                        }
                      >
                        {lastMessage.body}
                      </p>
                    ) : null}
                  </div>
                </CardContent>
              </Card>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
