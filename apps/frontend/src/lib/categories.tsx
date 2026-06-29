import {
  Wrench,
  Zap,
  Hammer,
  PaintRoller,
  BrickWall,
  SprayCan,
  Tag,
  Leaf,
  Clock,
  CalendarClock,
  Siren,
  Drill,
  Armchair,
  Tv,
  WashingMachine,
  AirVent,
  Trees,
  Truck,
  House,
  Bug,
  Flame,
  type LucideIcon,
} from 'lucide-react';
import { Badge, cn } from '@repo/ui';
import type { ComponentProps } from 'react';
import type { JobUrgency } from '@/lib/api/jobs';

type BadgeVariant = ComponentProps<typeof Badge>['variant'];

type CategoryMeta = {
  icon: LucideIcon;
  /** Icon/text colour, readable in both themes. */
  tint: string;
  /** Soft background tint used behind the icon / chip. */
  surface: string;
};

// Each service category gets a recognisable icon plus a soft tinted highlight so
// it reads at a glance. Keyed by the category `slug` from the seed data.
const CATEGORY_META: Record<string, CategoryMeta> = {
  plumbing: {
    icon: Wrench,
    tint: 'text-sky-600 dark:text-sky-400',
    surface: 'bg-sky-500/10',
  },
  electrical: {
    icon: Zap,
    tint: 'text-amber-600 dark:text-amber-400',
    surface: 'bg-amber-500/10',
  },
  carpentry: {
    icon: Hammer,
    tint: 'text-orange-600 dark:text-orange-400',
    surface: 'bg-orange-500/10',
  },
  painting: {
    icon: PaintRoller,
    tint: 'text-violet-600 dark:text-violet-400',
    surface: 'bg-violet-500/10',
  },
  masonry: {
    icon: BrickWall,
    tint: 'text-rose-600 dark:text-rose-400',
    surface: 'bg-rose-500/10',
  },
  cleaning: {
    icon: SprayCan,
    tint: 'text-emerald-600 dark:text-emerald-400',
    surface: 'bg-emerald-500/10',
  },
  handyman: {
    icon: Drill,
    tint: 'text-slate-600 dark:text-slate-300',
    surface: 'bg-slate-500/10',
  },
  'furniture-assembly': {
    icon: Armchair,
    tint: 'text-teal-600 dark:text-teal-400',
    surface: 'bg-teal-500/10',
  },
  mounting: {
    icon: Tv,
    tint: 'text-indigo-600 dark:text-indigo-400',
    surface: 'bg-indigo-500/10',
  },
  appliances: {
    icon: WashingMachine,
    tint: 'text-cyan-600 dark:text-cyan-400',
    surface: 'bg-cyan-500/10',
  },
  'air-conditioning': {
    icon: AirVent,
    tint: 'text-blue-600 dark:text-blue-400',
    surface: 'bg-blue-500/10',
  },
  gardening: {
    icon: Trees,
    tint: 'text-green-600 dark:text-green-400',
    surface: 'bg-green-500/10',
  },
  moving: {
    icon: Truck,
    tint: 'text-fuchsia-600 dark:text-fuchsia-400',
    surface: 'bg-fuchsia-500/10',
  },
  roofing: {
    icon: House,
    tint: 'text-stone-600 dark:text-stone-300',
    surface: 'bg-stone-500/10',
  },
  'pest-control': {
    icon: Bug,
    tint: 'text-red-600 dark:text-red-400',
    surface: 'bg-red-500/10',
  },
  welding: {
    icon: Flame,
    tint: 'text-yellow-600 dark:text-yellow-400',
    surface: 'bg-yellow-500/10',
  },
};

const DEFAULT_CATEGORY_META: CategoryMeta = {
  icon: Tag,
  tint: 'text-muted-foreground',
  surface: 'bg-muted',
};

export function categoryMeta(slug?: string | null): CategoryMeta {
  return (slug && CATEGORY_META[slug]) || DEFAULT_CATEGORY_META;
}

/** Just the category icon, tinted to its brand colour. */
export function CategoryIcon({
  slug,
  className,
}: {
  slug?: string | null;
  className?: string;
}) {
  const { icon: Icon, tint } = categoryMeta(slug);
  return <Icon className={cn('size-4', tint, className)} aria-hidden />;
}

/** A rounded icon bubble — for headers, cards and grids. */
export function CategoryIconBubble({
  slug,
  className,
  iconClassName,
}: {
  slug?: string | null;
  className?: string;
  iconClassName?: string;
}) {
  const { icon: Icon, tint, surface } = categoryMeta(slug);
  return (
    <span
      className={cn(
        'inline-flex items-center justify-center rounded-xl',
        surface,
        className,
      )}
    >
      <Icon className={cn('size-5', tint, iconClassName)} aria-hidden />
    </span>
  );
}

/** A tinted chip with the category icon + label. */
export function CategoryBadge({
  slug,
  label,
  className,
}: {
  slug?: string | null;
  label: string;
  className?: string;
}) {
  const { icon: Icon, tint, surface } = categoryMeta(slug);
  return (
    <Badge
      variant="outline"
      className={cn('gap-1 border-transparent', surface, tint, className)}
    >
      <Icon />
      {label}
    </Badge>
  );
}

// --- Urgency -----------------------------------------------------------------

const URGENCY_META: Record<
  JobUrgency,
  { icon: LucideIcon; variant: BadgeVariant }
> = {
  LOW: { icon: Leaf, variant: 'muted' },
  MEDIUM: { icon: Clock, variant: 'info' },
  HIGH: { icon: CalendarClock, variant: 'warning' },
  EMERGENCY: { icon: Siren, variant: 'destructive' },
};

/** A status-coloured chip with an urgency icon + label. */
export function UrgencyBadge({
  urgency,
  label,
  className,
}: {
  urgency: JobUrgency;
  label: string;
  className?: string;
}) {
  const { icon: Icon, variant } = URGENCY_META[urgency];
  return (
    <Badge variant={variant} className={className}>
      <Icon />
      {label}
    </Badge>
  );
}
