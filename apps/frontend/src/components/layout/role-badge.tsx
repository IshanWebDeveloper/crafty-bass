'use client';

import { Building2 } from 'lucide-react';
import { Badge } from '@repo/ui';
import type { Dictionary } from '@/i18n/dictionaries';
import type { UserType } from '@/lib/stores/session-store';
import { CategoryBadge } from '@/lib/categories';
import { tradeRoleLabel, tradeRoleSlug } from '@/lib/trade-role';

/**
 * Compact indicator of a signed-in user's marketplace role.
 *
 * A tradesman is labelled by their actual trade where we can resolve it from
 * `primaryTrade` ("Plumber", "Carpenter", …), and the badge takes on that
 * trade's brand colour + icon from the service-category palette (a sky-blue
 * wrench for plumbers, an amber bolt for electricians, …). Unrecognised trades
 * fall back to the raw trade name with neutral styling, then to the generic
 * "Tradesman". A homeowner gets a blue badge with the house icon.
 *
 * Renders nothing until the role is known (null = signed out or not yet chosen).
 */
export function RoleBadge({
  userType,
  primaryTrade,
  dict,
  className,
}: {
  userType: UserType;
  primaryTrade?: string | null;
  dict: Dictionary;
  className?: string;
}) {
  if (!userType) return null;

  if (userType === 'TRADESMAN') {
    const label =
      tradeRoleLabel(primaryTrade, dict.header.trades) ??
      dict.header.roleTradesman;
    return (
      <CategoryBadge
        slug={tradeRoleSlug(primaryTrade)}
        label={label}
        className={className}
      />
    );
  }

  return (
    <Badge variant="info" className={className}>
      <Building2 aria-hidden />
      {dict.header.roleHomeowner}
    </Badge>
  );
}
