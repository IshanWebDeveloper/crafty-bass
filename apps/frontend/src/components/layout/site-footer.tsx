import Link from 'next/link';
import type { Locale } from '@/i18n/config';
import type { Dictionary } from '@/i18n/dictionaries';
import { Logo } from '@/components/brand/logo';

/**
 * Site-wide footer. Mounted once in the locale layout so every page gets it.
 * Links only resolve to pages that exist (trades, jobs, terms, about, contact,
 * privacy); contact is reachable via email on the contact page.
 */
export function SiteFooter({
  locale,
  dict,
}: {
  locale: Locale;
  dict: Dictionary;
}) {
  const f = dict.footer;
  const base = `/${locale}`;

  const columns: {
    heading: string;
    links: { label: string; href: string }[];
  }[] = [
    {
      heading: f.explore,
      links: [
        { label: f.findTrades, href: `${base}/trades` },
        { label: f.browseJobs, href: `${base}/jobs` },
        { label: f.postJob, href: `${base}/jobs/new` },
      ],
    },
    {
      heading: f.company,
      links: [
        { label: f.about, href: `${base}/about` },
        { label: f.contact, href: `${base}/contact` },
        { label: f.guarantee, href: `${base}/guarantee` },
      ],
    },
    {
      heading: f.legal,
      links: [
        { label: f.terms, href: `${base}/terms` },
        { label: f.privacy, href: `${base}/privacy-policy` },
      ],
    },
  ];

  return (
    <footer className="mt-auto border-t border-border bg-canvas">
      <div className="mx-auto w-full max-w-7xl px-6 py-12 lg:px-14">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-[1.5fr_repeat(3,1fr)]">
          <div className="max-w-xs">
            <Link
              href={base}
              className="inline-flex rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label="Crafty Bass — home"
            >
              <Logo />
            </Link>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              {f.tagline}
            </p>
          </div>

          {columns.map((col) => (
            <nav key={col.heading} aria-label={col.heading}>
              <h2 className="text-sm font-semibold text-foreground">
                {col.heading}
              </h2>
              <ul className="mt-3 space-y-2.5">
                {col.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-sm text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <div className="mt-10 border-t border-border pt-6">
          <p className="text-xs text-muted-foreground">
            {f.rights.replace('{year}', String(new Date().getFullYear()))}
          </p>
        </div>
      </div>
    </footer>
  );
}
