// Decorative, non-interactive backdrop for the landing hero: three softly
// drifting brand-tinted glows over a faded grid. Purely visual, so it's
// aria-hidden and pointer-events-none; the drift respects prefers-reduced-motion
// (see globals.css). Colours use translucent oklch so they read as gentle tints
// on the light canvas and as glows in dark mode.
export function HeroBackdrop() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
    >
      <div className="hero-grid absolute inset-0" />
      <div className="animate-hero-blob-a absolute -left-[12%] -top-[28%] size-[36rem] rounded-full bg-[radial-gradient(circle_at_center,oklch(0.62_0.13_158_/_0.5),transparent_70%)] blur-3xl" />
      <div className="animate-hero-blob-b absolute -right-[10%] -top-[8%] size-[32rem] rounded-full bg-[radial-gradient(circle_at_center,oklch(0.7_0.11_195_/_0.42),transparent_70%)] blur-3xl" />
      <div className="animate-hero-blob-c absolute -bottom-[34%] left-[28%] size-[30rem] rounded-full bg-[radial-gradient(circle_at_center,oklch(0.8_0.12_82_/_0.34),transparent_70%)] blur-3xl" />
    </div>
  );
}
