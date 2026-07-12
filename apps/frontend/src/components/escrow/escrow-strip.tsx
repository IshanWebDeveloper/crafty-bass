import { Check } from 'lucide-react';
import { cn } from '@repo/ui';

export type EscrowStep = { label: string; note?: string };

/**
 * Escrow lifecycle stepper mirroring the design milestone strip:
 * Funded → Materials → Work done → Released. `current` is the number of
 * completed steps (0-steps.length); the step at `current` renders as active.
 * Presentational - pass localized `steps` from the dictionary.
 */
export function EscrowStrip({
  current,
  steps,
  className,
}: {
  current: number;
  steps: EscrowStep[];
  className?: string;
}) {
  return (
    <ol className={cn('flex items-start', className)}>
      {steps.map((step, i) => {
        const done = i < current;
        const active = i === current;
        const reached = done || active;
        return (
          <li
            key={step.label}
            className={cn(
              'flex items-start gap-2',
              i < steps.length - 1 && 'flex-1',
            )}
          >
            <div className="flex flex-col items-center gap-1.5">
              <span
                className={cn(
                  'inline-flex size-8 shrink-0 items-center justify-center rounded-full border text-xs font-semibold',
                  done &&
                    'border-transparent bg-success text-success-foreground',
                  active &&
                    'border-transparent bg-primary text-primary-foreground',
                  !reached && 'border-border bg-muted text-muted-foreground',
                )}
              >
                {done ? <Check className="size-4" aria-hidden /> : i + 1}
              </span>
              <span className="max-w-24 text-center leading-tight">
                <span
                  className={cn(
                    'block text-xs font-semibold',
                    reached ? 'text-foreground' : 'text-muted-foreground',
                  )}
                >
                  {step.label}
                </span>
                {step.note ? (
                  <span className="mt-0.5 block text-[11px] text-muted-foreground">
                    {step.note}
                  </span>
                ) : null}
              </span>
            </div>
            {i < steps.length - 1 ? (
              <span
                className={cn(
                  'mt-4 h-0.5 flex-1 rounded',
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
