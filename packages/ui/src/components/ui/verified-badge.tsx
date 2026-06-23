import * as React from 'react';

import { cn } from '@repo/ui/lib/utils';

/** Filled trust-seal path (Material "verified" geometry). The tick is the
 *  negative space inside the seal, so a single filled path renders the badge. */
const SEAL =
  'M23 12l-2.44-2.78.34-3.68-3.61-.82-1.89-3.18L12 1.43 8.6 1.54 6.71 4.72 3.1 5.53l.34 3.69L1 12l2.44 2.78-.34 3.69 3.61.82 1.89 3.18L12 22.57l3.4-1.11 1.89-3.18 3.61-.82-.34-3.68L23 12zm-12.91 4.72l-3.8-3.81 1.48-1.48 2.32 2.33 5.85-5.87 1.48 1.48-7.33 7.35z';

/**
 * Verified-tradesman seal — the trust mark shown beside a verified tradesman's
 * name. Brand green (`--success`) to match the verified avatar ring. Crafty
 * Bass verifies tradesmen manually (admin) against NIC, trade licences, address
 * and bank details; only verified tradesmen can receive jobs or quote. Pass
 * `label` to render text beside the seal (e.g. "Verified").
 */
function VerifiedBadge({
  size = 16,
  label,
  title = 'Verified',
  className,
  ...props
}: Omit<React.ComponentProps<'span'>, 'title'> & {
  size?: number;
  label?: string;
  title?: string;
}) {
  const labelled = Boolean(label);
  return (
    <span
      data-slot="verified-badge"
      title={title}
      className={cn(
        'inline-flex items-center gap-1 align-middle leading-none text-success',
        className,
      )}
      {...props}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="currentColor"
        role="img"
        aria-label={labelled ? undefined : title}
        aria-hidden={labelled ? true : undefined}
        className="block shrink-0"
      >
        <path d={SEAL} />
      </svg>
      {labelled && (
        <span className="text-[0.8125rem] font-medium leading-none text-foreground">
          {label}
        </span>
      )}
    </span>
  );
}

export { VerifiedBadge };
