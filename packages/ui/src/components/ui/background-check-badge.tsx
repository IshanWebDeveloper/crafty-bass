import * as React from 'react';

import { cn } from '@repo/ui/lib/utils';

/** Filled shield with the tick as negative space (evenodd), so a single
 *  currentColor path renders the whole badge - same trick as VerifiedBadge. */
const SHIELD =
  'M12 1.6l8 3v6.2c0 5.05-3.4 9.16-8 10.6-4.6-1.44-8-5.55-8-10.6V4.6l8-3z' +
  'M10.7 14.85l-2.55-2.55-1.4 1.4 3.95 3.95 6.95-6.95-1.4-1.4-5.55 5.55z';

/**
 * Background-check seal - shown for tradesmen who cleared Crafty Bass's
 * background / police-clearance check. Brand blue (`--info`) so it reads as a
 * distinct, stronger signal than the green `VerifiedBadge`, and is shown
 * *alongside* it (never instead of it). Pass `label` to render text beside it.
 */
function BackgroundCheckBadge({
  size = 16,
  label,
  title = 'Background checked',
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
      data-slot="background-check-badge"
      title={title}
      className={cn(
        'inline-flex items-center gap-1 align-middle leading-none text-info',
        className,
      )}
      {...props}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="currentColor"
        fillRule="evenodd"
        role="img"
        aria-label={labelled ? undefined : title}
        aria-hidden={labelled ? true : undefined}
        className="block shrink-0"
      >
        <path d={SHIELD} />
      </svg>
      {labelled && (
        <span className="text-[0.8125rem] font-medium leading-none text-foreground">
          {label}
        </span>
      )}
    </span>
  );
}

export { BackgroundCheckBadge };
