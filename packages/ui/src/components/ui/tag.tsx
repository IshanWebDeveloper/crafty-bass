import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@repo/ui/lib/utils';

/**
 * Pill-shaped tag for skills, service categories and filters. `active` is the
 * selected filter state; `soft`/`muted` are quieter tints. Pass `onRemove` to
 * render a dismiss affordance (used by the skills editor).
 */
const tagVariants = cva(
  'inline-flex items-center gap-1.5 border text-[0.8125rem] font-medium leading-none [&>svg]:pointer-events-none [&>svg]:size-3.5',
  {
    variants: {
      variant: {
        default: 'border-border bg-background text-foreground',
        active: 'border-transparent bg-primary text-primary-foreground',
        soft: 'border-transparent bg-accent-soft text-accent-soft-foreground',
        muted: 'border-transparent bg-muted text-muted-foreground',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

function Tag({
  className,
  variant = 'default',
  onRemove,
  removeLabel,
  children,
  ...props
}: React.ComponentProps<'span'> &
  VariantProps<typeof tagVariants> & {
    onRemove?: () => void;
    removeLabel?: string;
  }) {
  return (
    <span
      data-slot="tag"
      className={cn(
        tagVariants({ variant, className }),
        'rounded-md px-2.5 py-1.5',
        onRemove && 'pr-1.5',
      )}
      {...props}
    >
      {children}
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={removeLabel ?? 'Remove'}
          className="inline-flex size-4 items-center justify-center rounded-full bg-white/20 text-inherit transition-colors hover:bg-white/30"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            className="size-2.5"
            aria-hidden="true"
          >
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
      )}
    </span>
  );
}

export { Tag, tagVariants };
