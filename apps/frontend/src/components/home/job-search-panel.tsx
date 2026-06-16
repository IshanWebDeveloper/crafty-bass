import { buttonVariants, cn } from '@repo/ui';
import Link from 'next/link';

const services = [
  { label: 'Kitchen tap leak', meta: '28 plumbers nearby', highlighted: true },
  { label: 'Electrical socket', meta: '19 matches', highlighted: false },
  { label: 'Garden wall', meta: '26 matches', highlighted: false },
  { label: 'Bathroom tiling', meta: '33 matches', highlighted: false },
];

export function JobSearchPanel() {
  return (
    <div className="w-full rounded-lg border border-border bg-card p-8 shadow-[0px_1px_2px_0px_rgba(9,9,10,0.06)]">
      <h2 className="text-2xl font-bold tracking-tight text-foreground">
        What needs fixing?
      </h2>
      <ul className="mt-6 flex flex-col gap-3">
        {services.map((service) => (
          <li key={service.label}>
            <button
              type="button"
              className={cn(
                'flex w-full items-center justify-between rounded-md border border-border px-4 py-3 text-left transition-colors hover:bg-accent-soft',
                service.highlighted
                  ? 'bg-accent-soft text-accent-soft-foreground'
                  : 'bg-card',
              )}
            >
              <span className="text-base font-medium text-foreground">
                {service.label}
              </span>
              <span className="text-sm text-muted-foreground">
                {service.meta}
              </span>
            </button>
          </li>
        ))}
      </ul>
      <Link
        href="/trades"
        className={cn(
          buttonVariants({ size: 'lg' }),
          'mt-6 h-11 w-full rounded-md text-sm',
        )}
      >
        Find matches
      </Link>
    </div>
  );
}
