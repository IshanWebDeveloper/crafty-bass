import { SiteHeader } from '@/components/layout/site-header';
import { JobDetailView } from '@/components/jobs/job-detail-view';
import { getDictionary } from '@/i18n/dictionaries';
import { type Locale } from '@/i18n/config';

export default async function JobDetailPage({
  params,
}: {
  params: Promise<{ locale: Locale; id: string }>;
}) {
  const { locale, id } = await params;
  const dict = await getDictionary(locale);

  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <SiteHeader locale={locale} dict={dict} />
      <main className="flex-1">
        <div className="mx-auto w-full max-w-5xl px-6 py-10 lg:px-14">
          <JobDetailView locale={locale} dict={dict} jobId={id} />
        </div>
      </main>
    </div>
  );
}
