import Link from 'next/link';
import { ShieldCheck } from 'lucide-react';
import { cn } from '@repo/ui';
import type { Locale } from '@/i18n/config';
import type { Dictionary } from '@/i18n/dictionaries';

/**
 * A trust chip that links to the guarantee page. Shown wherever a homeowner is
 * making a protected decision (escrow card, fund page) so the Crafty Bass
 * Guarantee is visible at the point it matters. Backed by the same escrow that
 * holds the homeowner's money until they approve the work.
 */
export function GuaranteeBadge({
  locale,
  dict,
  className,
}: {
  locale: Locale;
  dict: Dictionary;
  className?: string;
}) {
  const t = dict.guarantee;
  return (
    <Link
      href={`/${locale}/guarantee`}
      title={t.badgeTooltip}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border border-transparent bg-accent-soft px-2.5 py-1 text-xs font-semibold text-accent-soft-foreground outline-none transition-colors hover:border-[color-mix(in_oklch,var(--accent-soft-foreground)_20%,transparent)] focus-visible:ring-2 focus-visible:ring-ring',
        className,
      )}
    >
      <ShieldCheck className="size-3.5" aria-hidden />
      {t.badge}
    </Link>
  );
}
