'use client';

import { Building2, Wrench } from 'lucide-react';
import { Badge } from '@repo/ui';
import type { Dictionary } from '@/i18n/dictionaries';
import type { UserType } from '@/lib/stores/session-store';
import { tradeRoleLabel } from '@/lib/trade-role';

/**
 * Compact indicator of a signed-in user's marketplace role. Reuses the same
 * icons as the sign-up role picker (house = homeowner, wrench = tradesman) so
 * the badge reads back the choice made at sign-up. Renders nothing until the
 * role is known (null = signed out or not yet chosen).
 *
 * A tradesman is labelled by their actual trade where we can resolve it from
 * `primaryTrade` ("Plumber", "Carpenter", …), falling back to the raw trade
 * name and then the generic "Tradesman".
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
  const isTradesman = userType === 'TRADESMAN';
  const Icon = isTradesman ? Wrench : Building2;

  const label = isTradesman
    ? (tradeRoleLabel(primaryTrade, dict.header.trades) ??
      dict.header.roleTradesman)
    : dict.header.roleHomeowner;

  return (
    <Badge variant={isTradesman ? 'success' : 'info'} className={className}>
      <Icon aria-hidden />
      {label}
    </Badge>
  );
}
