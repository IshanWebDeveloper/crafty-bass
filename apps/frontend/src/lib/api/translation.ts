import { apiFetch } from '../api';
import type { Locale } from '@/i18n/config';

export type TranslateResult = {
  translatedText: string;
  model: string;
};

export function translateText(input: {
  text: string;
  targetLocale: Locale;
  sourceLocale?: Locale;
}) {
  return apiFetch<TranslateResult>('/translate', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}
