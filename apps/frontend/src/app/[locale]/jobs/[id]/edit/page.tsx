import { SiteHeader } from '@/components/layout/site-header';
import { EditJobForm } from '@/components/jobs/edit-job-form';
import { getDictionary } from '@/i18n/dictionaries';
import { type Locale } from '@/i18n/config';
import { requireUserType } from '@/lib/server-session';

export default async function EditJobPage({
  params,
}: {
  params: Promise<{ locale: Locale; id: string }>;
}) {
  const { locale, id } = await params;
  // Editing a posted job is a homeowner action; ownership is re-checked in the
  // backend service (this is the UX guard).
  await requireUserType(locale, 'HOMEOWNER');
  const dict = await getDictionary(locale);
  const t = dict.jobs;

  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <SiteHeader locale={locale} dict={dict} />
      <main className="flex-1">
        <div className="mx-auto w-full max-w-2xl px-6 py-10 lg:px-14">
          <div className="mb-8">
            <h1 className="text-3xl font-semibold tracking-tight">
              {t.edit.title}
            </h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              {t.edit.subtitle}
            </p>
          </div>
          <EditJobForm locale={locale} dict={dict} jobId={id} />
        </div>
      </main>
    </div>
  );
}
