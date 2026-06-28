import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { notFound } from 'next/navigation';
import '../globals.css';
import { cn } from '@repo/ui';
import { Providers } from '@/components/providers';
import { SiteFooter } from '@/components/layout/site-footer';
import { I18nProvider } from '@/i18n/provider';
import { getDictionary } from '@/i18n/dictionaries';
import { locales, isLocale } from '@/i18n/config';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Crafty Bass',
  description: '',
};

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export default async function RootLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}>) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const dict = await getDictionary(locale);

  return (
    <html
      lang={locale}
      className={cn(inter.variable, 'h-full', 'antialiased', 'font-sans')}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col">
        <Providers>
          <I18nProvider locale={locale} dict={dict}>
            {children}
            <SiteFooter locale={locale} dict={dict} />
          </I18nProvider>
        </Providers>
      </body>
    </html>
  );
}
