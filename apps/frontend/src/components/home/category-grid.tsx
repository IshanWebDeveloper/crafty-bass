import Link from 'next/link';
import { Badge } from '@repo/ui';
import type { Locale } from '@/i18n/config';
import type { Dictionary } from '@/i18n/dictionaries';

const categories = [
  { key: 'plumbing', count: 18, href: '/trades?category=plumbing' },
  { key: 'electrical', count: 27, href: '/trades?category=electrical' },
  { key: 'carpentry', count: 36, href: '/trades?category=carpentry' },
  { key: 'painting', count: 45, href: '/trades?category=painting' },
] as const;

export function CategoryGrid({
  locale,
  dict,
}: {
  locale: Locale;
  dict: Dictionary;
}) {
  const t = dict.categories;

  return (
    <section className="mx-auto max-w-7xl px-6 pb-20 lg:px-14">
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {categories.map((category) => {
          const item = t.items[category.key];
          return (
            <Link
              key={category.key}
              href={`/${locale}${category.href}`}
              className="group flex flex-col rounded-xl border border-border bg-card p-6 shadow-soft transition-all hover:border-[color-mix(in_oklch,var(--border)_40%,var(--foreground)_20%)] hover:shadow-card"
            >
              <h3 className="text-xl font-semibold text-foreground">
                {item.title}
              </h3>
              <p className="mt-2 text-sm text-muted-foreground">{item.copy}</p>
              <div className="mt-auto pt-5">
                <Badge variant="soft">
                  {category.count} {t.available}
                </Badge>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
