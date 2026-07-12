import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { Badge } from '@repo/ui';
import { CategoryImage } from '@/lib/categories';
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
              className="group flex flex-col overflow-hidden rounded-xl border border-border bg-card shadow-soft transition-all hover:-translate-y-0.5 hover:border-[color-mix(in_oklch,var(--border)_40%,var(--foreground)_20%)] hover:shadow-card"
            >
              <CategoryImage
                slug={category.key}
                className="h-36 w-full transition-transform duration-300 group-hover:scale-[1.03]"
              />
              <div className="flex flex-1 flex-col p-6">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-xl font-semibold text-foreground">
                    {item.title}
                  </h3>
                  <ArrowUpRight className="size-5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  {item.copy}
                </p>
                <div className="mt-auto pt-5">
                  <Badge variant="soft">
                    {category.count} {t.available}
                  </Badge>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
