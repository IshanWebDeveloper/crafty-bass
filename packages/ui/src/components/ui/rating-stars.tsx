import * as React from 'react';

import { cn } from '@repo/ui/lib/utils';

// Lucide "star" path data (the project's icon library) inlined so ratings
// render with no runtime icon dependency.
const STAR =
  'M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z';

function Star({ filled }: { filled: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn('size-4', filled ? 'text-warning' : 'text-border')}
      aria-hidden="true"
    >
      <path d={STAR} />
    </svg>
  );
}

/**
 * Read-only star rating with optional numeric value + review count. Used on
 * tradesman cards, profiles and reviews.
 */
function RatingStars({
  value = 0,
  count,
  showValue = true,
  max = 5,
  className,
  ...props
}: React.ComponentProps<'span'> & {
  value?: number;
  count?: number;
  showValue?: boolean;
  max?: number;
}) {
  const rounded = Math.round(value);
  return (
    <span
      data-slot="rating-stars"
      className={cn('inline-flex items-center gap-1', className)}
      {...props}
    >
      <span className="inline-flex">
        {Array.from({ length: max }).map((_, i) => (
          <Star key={i} filled={i < rounded} />
        ))}
      </span>
      {showValue && (
        <span className="text-[0.8125rem] font-semibold text-foreground">
          {value.toFixed(1)}
        </span>
      )}
      {count != null && (
        <span className="text-[0.8125rem] text-muted-foreground">
          ({count})
        </span>
      )}
    </span>
  );
}

export { RatingStars };
