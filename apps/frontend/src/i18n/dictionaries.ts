import 'server-only';
import type { Locale } from './config';
import type en from './dictionaries/en.json';

// The English dictionary is the canonical shape; si/ta must match its keys.
export type Dictionary = typeof en;

const dictionaries: Record<Locale, () => Promise<Dictionary>> = {
  en: () => import('./dictionaries/en.json').then((m) => m.default),
  si: () => import('./dictionaries/si.json').then((m) => m.default),
  ta: () => import('./dictionaries/ta.json').then((m) => m.default),
};

export const getDictionary = (locale: Locale): Promise<Dictionary> =>
  dictionaries[locale]();
