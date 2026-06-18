import { NextResponse, type NextRequest } from 'next/server';
import { locales, defaultLocale } from '@/i18n/config';

// Next.js 16 renamed the `middleware` convention to `proxy`. This runs the
// locale redirect: requests without a `/<locale>` prefix are redirected to the
// best match from the Accept-Language header (falling back to the default).
function getLocale(request: NextRequest): string {
  const header = request.headers.get('accept-language');
  if (header) {
    const preferred = header
      .split(',')
      .map((part) => part.split(';')[0].trim().toLowerCase());
    for (const lang of preferred) {
      const base = lang.split('-')[0];
      const match = locales.find((l) => l === lang || l === base);
      if (match) return match;
    }
  }
  return defaultLocale;
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasLocale = locales.some(
    (l) => pathname === `/${l}` || pathname.startsWith(`/${l}/`),
  );
  if (hasLocale) return;

  const locale = getLocale(request);
  request.nextUrl.pathname = `/${locale}${pathname}`;
  return NextResponse.redirect(request.nextUrl);
}

export const config = {
  // Skip Next internals, API routes, and files with an extension (assets).
  matcher: ['/((?!_next|api|.*\\..*).*)'],
};
