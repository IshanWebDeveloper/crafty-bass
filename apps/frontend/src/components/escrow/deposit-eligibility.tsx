'use client';

import { ArrowUpRight, HandCoins } from 'lucide-react';
import { Badge, cn } from '@repo/ui';
import { depositTier, maxDeposit, type TradesmanTrust } from '@repo/validation';
import { formatLKR } from '@/lib/currency';
import type { Dictionary } from '@/i18n/dictionaries';

/**
 * Shows the tradesman's deposit tier, the amount they may request on this
 * quote, and the next step to unlock a higher tier - mirroring the design's
 * DepositEligibility band. Uses the shared depositTier/maxDeposit logic so the
 * UI and backend guard agree exactly.
 */
export function DepositEligibility({
  trust,
  quoteTotal,
  materialsAmount,
  dict,
}: {
  trust: TradesmanTrust;
  quoteTotal: number;
  materialsAmount: number;
  dict: Dictionary;
}) {
  const t = dict.escrow.eligibility;
  const tier = depositTier(trust);
  const allowed = maxDeposit(trust, quoteTotal, materialsAmount);
  const ok = tier.key !== 'none';

  return (
    <div className="overflow-hidden rounded-xl border border-border">
      <div
        className={cn(
          'flex items-center gap-3 px-4 py-3.5',
          ok ? 'bg-accent-soft' : 'bg-muted',
        )}
      >
        <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-md bg-background text-foreground">
          <HandCoins className="size-[18px]" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold">{t.title}</span>
            <Badge variant={ok ? 'soft' : 'muted'}>
              {t.tier.replace('{tier}', t.tiers[tier.key])}
            </Badge>
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {ok
              ? t.upTo
                  .replace('{pct}', String(tier.pct))
                  .replace('{cap}', formatLKR(tier.cap))
              : t.locked}
          </p>
        </div>
        {ok ? (
          <div className="shrink-0 text-right">
            <p className="text-[11px] text-muted-foreground">
              {t.youCanRequest}
            </p>
            <p className="font-mono text-base font-semibold">
              {formatLKR(allowed)}
            </p>
          </div>
        ) : null}
      </div>
      <div className="flex items-center gap-2 px-4 py-2.5 text-xs text-muted-foreground">
        <ArrowUpRight className="size-3.5 shrink-0" aria-hidden />
        {t.next[tier.key]}
      </div>
    </div>
  );
}
