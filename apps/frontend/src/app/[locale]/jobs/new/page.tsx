import { SiteHeader } from '@/components/layout/site-header';
import { PostJobForm } from '@/components/jobs/post-job-form';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { getDictionary } from '@/i18n/dictionaries';
import { type Locale } from '@/i18n/config';
import { requireUserType } from '@/lib/server-session';

export default async function NewJobPage({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  await requireUserType(locale, 'HOMEOWNER');
  const dict = await getDictionary(locale);
  const t = dict.jobs;

  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <SiteHeader locale={locale} dict={dict} />
      <main className="flex-1">
        <div className="mx-auto w-full max-w-2xl px-6 py-10 lg:px-14">
          <Card>
            <CardHeader>
              <CardTitle>{t.new.title}</CardTitle>
              <CardDescription>{t.new.subtitle}</CardDescription>
            </CardHeader>
            <CardContent>
              <PostJobForm locale={locale} dict={dict} />
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
