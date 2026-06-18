export const locales = ['en', 'si', 'ta'] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = 'en';

export function isLocale(value: string): value is Locale {
  return (locales as readonly string[]).includes(value);
}

// Native language names for the locale switcher.
export const localeNames: Record<Locale, string> = {
  en: 'English',
  si: 'සිංහල',
  ta: 'தமிழ்',
};
