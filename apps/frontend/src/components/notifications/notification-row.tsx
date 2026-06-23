import Link from 'next/link';
import {
  BadgeCheck,
  Bell,
  CircleCheckBig,
  HandCoins,
  Lock,
  MessageCircle,
  ReceiptText,
  Star,
  Users,
  Wrench,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@repo/ui';
import type { AppNotification, NotificationTint } from './notifications-data';

const ICONS: Record<string, LucideIcon> = {
  'hand-coins': HandCoins,
  'message-circle': MessageCircle,
  'receipt-text': ReceiptText,
  lock: Lock,
  wrench: Wrench,
  star: Star,
  'badge-check': BadgeCheck,
  'circle-check-big': CircleCheckBig,
  users: Users,
};

function tintClasses(tint: NotificationTint) {
  if (tint === 'green') return 'bg-accent-soft text-foreground';
  if (tint === 'amber') return 'bg-highlight text-foreground';
  return 'bg-muted text-muted-foreground';
}

export function NotificationRow({
  n,
  locale,
  compact,
  onRead,
}: {
  n: AppNotification;
  locale: string;
  compact?: boolean;
  onRead?: (id: string) => void;
}) {
  const Icon = ICONS[n.icon] ?? Bell;
  const href = n.href ? `/${locale}/${n.href}` : undefined;

  const body = (
    <div
      className={cn(
        'flex items-start gap-3',
        compact ? 'px-4 py-3' : 'px-5 py-4',
        n.unread && 'bg-muted/60',
      )}
    >
      <span
        className={cn(
          'inline-flex size-9 shrink-0 items-center justify-center rounded-md',
          tintClasses(n.tint),
        )}
      >
        <Icon className="size-[18px]" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2.5">
          <p
            className={cn(
              'min-w-0 flex-1 text-sm leading-snug',
              n.unread ? 'font-semibold' : 'font-medium',
            )}
          >
            {n.title}
          </p>
          <span className="shrink-0 text-[11px] text-muted-foreground">
            {n.time}
          </span>
        </div>
        {n.body ? (
          <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
            {n.body}
          </p>
        ) : null}
        {n.action ? (
          <div className="mt-2.5">
            <span className="inline-flex h-7 items-center rounded-lg border border-border bg-background px-3 text-sm font-medium">
              {n.action}
            </span>
          </div>
        ) : null}
      </div>
      {n.unread ? (
        <span className="mt-1.5 size-2 shrink-0 rounded-full bg-primary" />
      ) : null}
    </div>
  );

  const handleClick = () => onRead?.(n.id);

  if (href) {
    return (
      <Link href={href} onClick={handleClick} className="block">
        {body}
      </Link>
    );
  }
  return (
    <button
      type="button"
      onClick={handleClick}
      className="block w-full text-left"
    >
      {body}
    </button>
  );
}
