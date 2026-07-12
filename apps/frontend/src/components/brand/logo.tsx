import { cn } from '@repo/ui';

/**
 * Crafty Bass brand mark — a rounded "tile" in the brand green carrying a
 * white house-with-checkmark glyph (the platform promise: a trusted home
 * trade). Drawn with `currentColor`-independent fills so it reads the same in
 * light and dark themes; only the wordmark inherits text colour.
 *
 * Use {@link LogoMark} alone for square spots (favicon, avatars, compact nav)
 * and {@link Logo} for the full lockup (mark + wordmark) in the header/footer.
 */
export function LogoMark({
  className,
  title = 'Crafty Bass',
}: {
  className?: string;
  title?: string;
}) {
  return (
    <svg
      viewBox="0 0 32 32"
      role="img"
      aria-label={title}
      className={cn('size-8', className)}
    >
      <defs>
        <linearGradient id="cb-mark" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="oklch(0.66 0.12 158)" />
          <stop offset="1" stopColor="oklch(0.56 0.11 158)" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="8.5" fill="url(#cb-mark)" />
      {/* roof + walls */}
      <path
        d="M7.5 15.5 16 8l8.5 7.5"
        fill="none"
        stroke="#fff"
        strokeWidth="2.1"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M9.8 14v9.2a1 1 0 0 0 1 1h10.4a1 1 0 0 0 1-1V14"
        fill="none"
        stroke="#fff"
        strokeWidth="2.1"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* approval check inside the home */}
      <path
        d="m12.8 18.8 2.2 2.2 4.2-4.4"
        fill="none"
        stroke="#fff"
        strokeWidth="2.1"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function Logo({
  className,
  markClassName,
  wordmarkClassName,
}: {
  className?: string;
  markClassName?: string;
  wordmarkClassName?: string;
}) {
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <LogoMark className={markClassName} />
      <span
        className={cn(
          'text-xl font-semibold tracking-tight text-foreground',
          wordmarkClassName,
        )}
      >
        Crafty Bass
      </span>
    </span>
  );
}
