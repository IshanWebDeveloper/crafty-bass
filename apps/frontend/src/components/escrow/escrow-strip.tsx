import { Check } from 'lucide-react';
import { cn } from '@repo/ui';

/**
 * Escrow lifecycle stepper: deposit funded → work in progress → balance
 * released. `current` is the active step index (0–2); earlier steps render as
 * complete. Presentational — pass localized `steps` labels from the dictionary.
 */
export function EscrowStrip({
  current,
  steps,
  className,
}: {
  current: number;
  steps: [string, string, string];
  className?: string;
}) {
  return (
    <ol className={cn('flex items-center', className)}>
      {steps.map((label, i) => {
        const done = i < current;
        const active = i === current;
        const reached = done || active;
        return (
          <li
            key={label}
            className={cn(
              'flex items-center gap-2',
              i < steps.length - 1 && 'flex-1',
            )}
          >
            <span
              className={cn(
                'inline-flex size-6 shrink-0 items-center justify-center rounded-full border text-xs font-semibold',
                done && 'border-transparent bg-success text-success-foreground',
                active && 'border-primary bg-primary text-primary-foreground',
                !reached && 'border-border bg-background text-muted-foreground',
              )}
            >
              {done ? <Check className="size-3.5" aria-hidden /> : i + 1}
            </span>
            <span
              className={cn(
                'text-xs font-medium whitespace-nowrap',
                reached ? 'text-foreground' : 'text-muted-foreground',
              )}
            >
              {label}
            </span>
            {i < steps.length - 1 ? (
              <span
                className={cn(
                  'mx-2 hidden h-px flex-1 sm:block',
                  done ? 'bg-success' : 'bg-border',
                )}
              />
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
