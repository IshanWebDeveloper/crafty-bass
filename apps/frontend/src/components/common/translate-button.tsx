'use client';

import { useState } from 'react';
import { Languages, Loader2, Sparkles } from 'lucide-react';
import { cn } from '@repo/ui';
import { translateText } from '@/lib/api/translation';
import type { Locale } from '@/i18n/config';
import type { Dictionary } from '@/i18n/dictionaries';

/**
 * One-click translation of user-generated content (job descriptions, reviews,
 * tradesperson bios) into the viewer's current locale. Shows the result inline
 * with an AI disclaimer and a toggle back to the original. The backend proxies
 * to the AI service, so an unset LLM/credential surfaces as a soft error toast
 * rather than breaking the card.
 */
export function TranslateButton({
  text,
  locale,
  dict,
  className,
}: {
  text: string;
  locale: Locale;
  dict: Dictionary;
  className?: string;
}) {
  const t = dict.translate;
  const [translated, setTranslated] = useState<string | null>(null);
  const [shown, setShown] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  async function onClick() {
    // Cached after the first call — just toggle visibility afterwards.
    if (translated) {
      setShown((s) => !s);
      return;
    }
    setLoading(true);
    setError(false);
    try {
      const result = await translateText({ text, targetLocale: locale });
      setTranslated(result.translatedText);
      setShown(true);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={cn('space-y-2', className)}>
      <button
        type="button"
        onClick={() => void onClick()}
        disabled={loading}
        className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline disabled:opacity-60"
      >
        {loading ? (
          <Loader2 className="size-3.5 animate-spin" aria-hidden />
        ) : (
          <Languages className="size-3.5" aria-hidden />
        )}
        {loading ? t.translating : translated && shown ? t.hide : t.action}
      </button>

      {error ? <p className="text-xs text-destructive">{t.failed}</p> : null}

      {translated && shown ? (
        <div className="rounded-lg border border-border bg-muted/50 p-3">
          <p className="whitespace-pre-line text-sm text-foreground">
            {translated}
          </p>
          <p className="mt-2 inline-flex items-center gap-1 text-[0.7rem] text-muted-foreground">
            <Sparkles className="size-3" aria-hidden />
            {t.disclaimer}
          </p>
        </div>
      ) : null}
    </div>
  );
}
