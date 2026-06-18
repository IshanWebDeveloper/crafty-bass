import { SiteHeader } from '@/components/layout/site-header';
import { ThreadView } from '@/components/chat/thread-view';
import { getDictionary } from '@/i18n/dictionaries';
import { type Locale } from '@/i18n/config';

export default async function MessageThreadPage({
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
        <div className="mx-auto w-full max-w-3xl px-6 py-10 lg:px-14">
          <ThreadView locale={locale} dict={dict} conversationId={id} />
        </div>
      </main>
    </div>
  );
}
