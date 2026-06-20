import Link from 'next/link';
import { Button } from '@repo/ui';
import { SiteHeader } from '@/components/layout/site-header';
import { MyJobsList } from '@/components/jobs/my-jobs-list';
import { getDictionary } from '@/i18n/dictionaries';
import { type Locale } from '@/i18n/config';

export default async function MyJobsPage({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  const dict = await getDictionary(locale);
  const t = dict.jobs;

  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <SiteHeader locale={locale} dict={dict} />
      <main className="flex-1">
        <div className="mx-auto w-full max-w-5xl px-6 py-10 lg:px-14">
          <div className="mb-8 flex items-end justify-between gap-4">
            <div>
              <h1 className="text-3xl font-semibold tracking-tight">
                {t.mine.title}
              </h1>
              <p className="text-sm text-muted-foreground">{t.mine.subtitle}</p>
            </div>
            <Button
              nativeButton={false}
              render={<Link href={`/${locale}/jobs/new`} />}
            >
              {t.mine.postOne}
            </Button>
          </div>
          <MyJobsList locale={locale} dict={dict} />
        </div>
      </main>
    </div>
  );
}
