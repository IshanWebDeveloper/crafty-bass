import Link from 'next/link';
import type { Locale } from '@/i18n/config';

const categories = [
  {
    title: 'Plumbing',
    copy: 'Leaks, boilers, drains, fittings',
    available: '18 available',
    href: '/trades?category=plumbing',
  },
  {
    title: 'Electrical',
    copy: 'Repairs, installs, safety checks',
    available: '27 available',
    href: '/trades?category=electrical',
  },
  {
    title: 'Carpentry',
    copy: 'Doors, flooring, custom builds',
    available: '36 available',
    href: '/trades?category=carpentry',
  },
  {
    title: 'Painting',
    copy: 'Interior, exterior, finishing',
    available: '45 available',
    href: '/trades?category=painting',
  },
];

export function CategoryGrid({ locale }: { locale: Locale }) {
  return (
    <section className="mx-auto max-w-7xl px-6 pb-20 lg:px-14">
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {categories.map((category) => (
          <Link
            key={category.title}
            href={`/${locale}${category.href}`}
            className="group flex flex-col rounded-xl border border-border bg-card p-6 shadow-card transition-colors hover:border-foreground/20"
          >
            <h3 className="text-xl font-semibold text-foreground">
              {category.title}
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">
              {category.copy}
            </p>
            <div className="mt-auto pt-5">
              <span className="inline-flex w-fit items-center rounded-md bg-accent-soft px-3 py-1.5 text-xs font-medium text-muted-foreground">
                {category.available}
              </span>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
