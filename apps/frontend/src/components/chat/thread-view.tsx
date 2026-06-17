'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  Button,
  cn,
  Skeleton,
} from '@repo/ui';
import { toast } from 'sonner';
import { Textarea } from '@/components/ui/textarea';
import {
  getConversation,
  listMessages,
  markRead,
  sendMessage,
} from '@/lib/api/conversations';
import { useSession } from '@/lib/auth-client';
import type { Locale } from '@/i18n/config';
import type { Dictionary } from '@/i18n/dictionaries';

export function ThreadView({
  locale,
  dict,
  conversationId,
}: {
  locale: Locale;
  dict: Dictionary;
  conversationId: string;
}) {
  const qc = useQueryClient();
  const { data: session } = useSession();
  const t = dict.chat.thread;
  const [body, setBody] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  const { data: conversation } = useQuery({
    queryKey: ['conversations', conversationId],
    queryFn: () => getConversation(conversationId),
  });

  const { data: messages, isLoading } = useQuery({
    queryKey: ['conversations', conversationId, 'messages'],
    queryFn: () => listMessages(conversationId),
    refetchInterval: 4000,
  });

  // Auto-scroll on new messages.
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages?.data.length]);

  // Mark as read whenever the thread is viewed.
  useEffect(() => {
    if (!messages || messages.data.length === 0) return;
    void markRead(conversationId).then(() => {
      void qc.invalidateQueries({ queryKey: ['conversations'] });
    });
  }, [messages?.data.length, conversationId, qc, messages]);

  const send = useMutation({
    mutationFn: (text: string) => sendMessage(conversationId, text),
    onSuccess: () => {
      setBody('');
      void qc.invalidateQueries({
        queryKey: ['conversations', conversationId, 'messages'],
      });
      void qc.invalidateQueries({ queryKey: ['conversations'] });
    },
    onError: (err) =>
      toast.error(err instanceof Error ? err.message : 'Failed to send'),
  });

  if (!session) return null;
  const currentUserId = session.user.id;
  const other = conversation?.participants.find(
    (p) => p.userId !== currentUserId,
  );

  return (
    <div className="flex h-[calc(100vh-12rem)] flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <Link
          href={`/${locale}/messages`}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          {t.back}
        </Link>
        {conversation?.job ? (
          <Link
            href={`/${locale}/jobs/${conversation.job.id}`}
            className="truncate text-sm text-muted-foreground underline-offset-4 hover:underline"
          >
            {conversation.job.title}
          </Link>
        ) : null}
      </div>

      <div className="flex-1 overflow-y-auto rounded-xl border border-border bg-card p-4">
        {isLoading || !messages ? (
          <div className="space-y-2">
            <Skeleton className="h-12 w-2/3" />
            <Skeleton className="ml-auto h-12 w-1/2" />
          </div>
        ) : messages.data.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t.loading}</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {[...messages.data].reverse().map((msg) => {
              const mine = msg.senderId === currentUserId;
              const initials =
                (mine ? session.user.name : other?.user.name)
                  ?.split(' ')
                  .map((p) => p[0])
                  .filter(Boolean)
                  .slice(0, 2)
                  .join('')
                  .toUpperCase() ?? '?';
              return (
                <li
                  key={msg.id}
                  className={cn(
                    'flex max-w-[80%] gap-2',
                    mine ? 'ml-auto flex-row-reverse' : '',
                  )}
                >
                  <Avatar className="h-7 w-7">
                    {!mine && other?.user.image ? (
                      <AvatarImage
                        src={other.user.image}
                        alt={other.user.name}
                      />
                    ) : null}
                    <AvatarFallback className="text-[10px]">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  <div
                    className={cn(
                      'rounded-2xl px-3.5 py-2',
                      mine
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-foreground',
                    )}
                  >
                    <p className="whitespace-pre-line text-sm">{msg.body}</p>
                    <p
                      className={cn(
                        'mt-1 text-[10px]',
                        mine
                          ? 'text-primary-foreground/70'
                          : 'text-muted-foreground',
                      )}
                    >
                      {new Date(msg.createdAt).toLocaleString(locale, {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>
                </li>
              );
            })}
            <div ref={bottomRef} />
          </ul>
        )}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (body.trim().length === 0) return;
          send.mutate(body.trim());
        }}
        className="flex items-end gap-2"
      >
        <Textarea
          rows={2}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder={t.placeholder}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              if (body.trim().length > 0) send.mutate(body.trim());
            }
          }}
        />
        <Button
          type="submit"
          disabled={send.isPending || body.trim().length === 0}
        >
          {send.isPending ? t.sending : t.send}
        </Button>
      </form>
    </div>
  );
}
