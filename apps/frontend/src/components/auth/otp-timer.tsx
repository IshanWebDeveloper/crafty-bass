'use client';

import { useEffect, useState } from 'react';
import { cn } from '@repo/ui';

/**
 * Counts down the validity window of a one-time code. Both the phone and email
 * OTPs expire 5 minutes after they're sent (see `expiresIn: 300` in the
 * better-auth config, @repo/auth). Driven off the send timestamp so it stays
 * accurate across re-renders; pass a fresh `sentAt` on resend to restart it.
 */
export function OtpTimer({
  sentAt,
  durationSec = 300,
  expiresInLabel,
  expiredLabel,
}: {
  sentAt: number;
  durationSec?: number;
  /** "Code expires in {time}" - {time} is replaced with M:SS. */
  expiresInLabel: string;
  expiredLabel: string;
}) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const remaining = Math.max(
    0,
    Math.ceil((sentAt + durationSec * 1000 - now) / 1000),
  );
  const expired = remaining <= 0;
  const minutes = Math.floor(remaining / 60);
  const seconds = remaining % 60;
  const formatted = `${minutes}:${String(seconds).padStart(2, '0')}`;

  return (
    <p
      aria-live="polite"
      className={cn(
        'text-xs',
        expired ? 'text-destructive' : 'text-muted-foreground',
      )}
    >
      {expired ? expiredLabel : expiresInLabel.replace('{time}', formatted)}
    </p>
  );
}
