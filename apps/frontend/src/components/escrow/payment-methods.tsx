'use client';

import { CreditCard, QrCode, Wallet } from 'lucide-react';
import { cn } from '@repo/ui';
import type { EscrowPaymentMethod } from '@/lib/api/escrow';
import type { Dictionary } from '@/i18n/dictionaries';

const ICONS = {
  card: CreditCard,
  paypal: Wallet,
  local: QrCode,
} as const;

const ORDER: EscrowPaymentMethod[] = ['card', 'paypal', 'local'];

/**
 * Selectable payment-method cards (card / PayPal / local LKR gateways),
 * mirroring the design's escrow fund flow.
 */
export function PaymentMethods({
  value,
  onChange,
  dict,
}: {
  value: EscrowPaymentMethod;
  onChange: (method: EscrowPaymentMethod) => void;
  dict: Dictionary;
}) {
  const t = dict.escrow.methods;
  return (
    <div className="grid grid-cols-3 gap-2">
      {ORDER.map((key) => {
        const Icon = ICONS[key];
        const active = value === key;
        return (
          <button
            key={key}
            type="button"
            onClick={() => onChange(key)}
            aria-pressed={active}
            className={cn(
              'flex flex-col gap-2.5 rounded-lg border p-3 text-left transition-colors',
              active
                ? 'border-primary bg-muted'
                : 'border-border bg-background hover:bg-muted/50',
            )}
          >
            <div className="flex items-center justify-between">
              <Icon
                className={cn(
                  'size-[18px]',
                  active ? 'text-foreground' : 'text-muted-foreground',
                )}
                aria-hidden
              />
              <span
                className={cn(
                  'size-4 shrink-0 rounded-full border',
                  active ? 'border-[5px] border-primary' : 'border-border',
                )}
              />
            </div>
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold">
                {t[key].label}
              </span>
              <span className="block text-[11px] leading-snug text-muted-foreground">
                {t[key].note}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
