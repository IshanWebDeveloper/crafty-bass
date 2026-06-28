'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery } from '@tanstack/react-query';
import {
  Camera,
  ChevronDown,
  Loader2,
  Lock,
  MapPin,
  Sparkles,
  X,
} from 'lucide-react';
import { Badge, Button, Combobox, DatePicker, Input } from '@repo/ui';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@repo/ui';
import { toast } from 'sonner';
import { Label } from '@/components/ui/label';
import { parseDateInput, formatDateInput } from '@/lib/date';
import { Textarea } from '@/components/ui/textarea';
import { createJob, type JobUrgency, type LanguageCode } from '@/lib/api/jobs';
import { listCategories, type ServiceCategory } from '@/lib/api/categories';
import { CategoryIcon } from '@/lib/categories';
import { DISTRICT_OPTIONS } from '@/lib/districts';
import { ApiError } from '@/lib/api';
import { useMe } from '@/lib/hooks/use-me';
import type { Locale } from '@/i18n/config';
import type { Dictionary } from '@/i18n/dictionaries';

const URGENCY_OPTIONS: JobUrgency[] = ['LOW', 'MEDIUM', 'HIGH', 'EMERGENCY'];

const PostJobSchema = z
  .object({
    title: z.string().trim().min(3).max(160),
    description: z.string().trim().min(10).max(5000),
    descriptionLanguage: z.enum(['EN', 'SI', 'TA']),
    categoryId: z.string().optional(),
    urgency: z.enum(URGENCY_OPTIONS),
    city: z.string().trim().max(80).optional(),
    district: z.string().trim().max(80).optional(),
    budgetMin: z.string().optional(),
    budgetMax: z.string().optional(),
    scheduledFor: z.string().optional(),
  })
  .refine(
    (v) => {
      if (!v.budgetMin || !v.budgetMax) return true;
      return Number(v.budgetMax) >= Number(v.budgetMin);
    },
    { message: 'Max must be ≥ min', path: ['budgetMax'] },
  );

type PostJobValues = z.infer<typeof PostJobSchema>;

function parseOptionalNumber(value: string | undefined) {
  if (value === undefined || value === '') return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

const localeToLanguageCode: Record<Locale, LanguageCode> = {
  en: 'EN',
  si: 'SI',
  ta: 'TA',
};

// Keyword cues per category slug — a lightweight stand-in for the LLM classifier
// (the AI service) that keeps the "detect as you type" UX working client-side.
const KEYWORDS: Record<string, string[]> = {
  plumbing: [
    'leak',
    'tap',
    'mixer',
    'drain',
    'pipe',
    'water',
    'boiler',
    'sink',
    'shower',
    'toilet',
  ],
  electrical: [
    'wir',
    'socket',
    'light',
    'fan',
    'power',
    'rcd',
    'fuse',
    'switch',
    'electric',
  ],
  carpentry: [
    'door',
    'wood',
    'floor',
    'cabinet',
    'shelf',
    'frame',
    'timber',
    'joinery',
  ],
  painting: [
    'paint',
    'repaint',
    'wall',
    'ceiling',
    'primer',
    'emulsion',
    'finish',
  ],
  masonry: [
    'wall',
    'brick',
    'tile',
    'concrete',
    'plaster',
    'cement',
    'render',
    'waterproof',
  ],
};
const SKILL_HINTS: Record<string, string[]> = {
  plumbing: ['Leak repair', 'Taps & fittings'],
  electrical: ['Wiring & rewiring', 'Sockets & switches'],
  carpentry: ['Doors & frames', 'Flooring'],
  painting: ['Interior', 'Crack filling'],
  masonry: ['Tiling', 'Wall building'],
};

function classify(
  text: string | undefined,
  categories: ServiceCategory[] | undefined,
): { categoryId: string; confidence: number; skills: string[] } | null {
  const t = (text ?? '').toLowerCase();
  if (t.trim().length < 12 || !categories?.length) return null;
  let bestSlug: string | null = null;
  let bestScore = 0;
  for (const [slug, words] of Object.entries(KEYWORDS)) {
    const score = words.reduce((n, w) => n + (t.includes(w) ? 1 : 0), 0);
    if (score > bestScore) {
      bestScore = score;
      bestSlug = slug;
    }
  }
  if (!bestSlug) return null;
  const match = categories.find(
    (c) =>
      c.slug === bestSlug ||
      c.nameEn.toLowerCase().includes(bestSlug as string),
  );
  if (!match) return null;
  return {
    categoryId: match.id,
    confidence: Math.min(96, 60 + bestScore * 8),
    skills: SKILL_HINTS[bestSlug] ?? [],
  };
}

export function PostJobForm({
  locale,
  dict,
}: {
  locale: Locale;
  dict: Dictionary;
}) {
  const router = useRouter();
  const t = dict.jobs;
  const [submitting, setSubmitting] = useState(false);

  // Posting a job is for homeowners. Authentication is enforced server-side by
  // requireAuth() on the route, so we only handle the userType rule here (mirror
  // of jobs.service): tradesmen are bounced (they can't post); a homeowner or a
  // brand-new user with no userType yet (auto-promoted on first post) may proceed.
  const { data: me, isLoading: meLoading } = useMe();
  const isTradesman = me?.userType === 'TRADESMAN';
  const authzReady = !meLoading && !isTradesman;
  useEffect(() => {
    if (!meLoading && isTradesman) {
      router.replace(`/${locale}/jobs`);
    }
  }, [meLoading, isTradesman, router, locale]);

  const { data: categories } = useQuery({
    queryKey: ['categories'],
    queryFn: listCategories,
    staleTime: 5 * 60_000,
  });

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<PostJobValues>({
    resolver: zodResolver(PostJobSchema),
    defaultValues: {
      title: '',
      description: '',
      descriptionLanguage: localeToLanguageCode[locale],
      urgency: 'MEDIUM',
      categoryId: '',
      city: '',
      district: '',
      scheduledFor: '',
    },
  });

  // --- Local AI-style classifier (keyword match). Reads the description as the
  // homeowner types and suggests the category + skills. The Job model already
  // has ai* fields; wiring the real LLM classify endpoint is a follow-up.
  const description = watch('description');
  const selectedCategoryId = watch('categoryId');
  const selectedUrgency = watch('urgency');
  const [detection, setDetection] = useState<{
    categoryId: string;
    confidence: number;
    skills: string[];
  } | null>(null);
  useEffect(() => {
    const handle = setTimeout(() => {
      const result = classify(description, categories);
      setDetection(result);
      if (result) setValue('categoryId', result.categoryId);
    }, 400);
    return () => clearTimeout(handle);
  }, [description, categories, setValue]);

  // --- Photo picker (local preview only — persistence needs image storage +
  // a Job.photos field, both follow-ups).
  const [photos, setPhotos] = useState<{ id: string; url: string }[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const addPhotos = useCallback((files: FileList | null) => {
    const images = Array.from(files ?? []).filter((f) =>
      f.type.startsWith('image/'),
    );
    if (!images.length) return;
    setPhotos((prev) =>
      prev
        .concat(
          images.slice(0, Math.max(0, 8 - prev.length)).map((f) => ({
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            url: URL.createObjectURL(f),
          })),
        )
        .slice(0, 8),
    );
  }, []);
  const removePhoto = useCallback((id: string) => {
    setPhotos((prev) => {
      const gone = prev.find((p) => p.id === id);
      if (gone) URL.revokeObjectURL(gone.url);
      return prev.filter((p) => p.id !== id);
    });
  }, []);

  // --- Optional GPS pin shared when posting.
  const [loc, setLoc] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const shareLocation = useCallback(() => {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setLoc({ lat: p.coords.latitude, lng: p.coords.longitude });
        setLocating(false);
      },
      () => setLocating(false),
      { timeout: 8000 },
    );
  }, []);

  async function onSubmit(values: PostJobValues) {
    setSubmitting(true);
    try {
      const job = await createJob({
        title: values.title,
        description: values.description,
        descriptionLanguage: values.descriptionLanguage,
        urgency: values.urgency,
        categoryId: values.categoryId || undefined,
        city: values.city || undefined,
        district: values.district || undefined,
        latitude: loc?.lat,
        longitude: loc?.lng,
        budgetMin: parseOptionalNumber(values.budgetMin),
        budgetMax: parseOptionalNumber(values.budgetMax),
        scheduledFor: values.scheduledFor || undefined,
      });
      toast.success(t.new.success);
      router.push(`/${locale}/jobs/${job.id}`);
      router.refresh();
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Failed to post job';
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  }

  const categoryDisplayName = (category: {
    nameEn: string;
    nameSi: string | null;
    nameTa: string | null;
  }) => {
    if (locale === 'si' && category.nameSi) return category.nameSi;
    if (locale === 'ta' && category.nameTa) return category.nameTa;
    return category.nameEn;
  };

  const selectedUrgencyLabel = t.urgencyLabels[selectedUrgency];

  // Searchable category options — label is the localized name, with the slug
  // carried through so the dropdown row can render the matching icon.
  const categoryOptions = useMemo(
    () =>
      (categories ?? []).map((cat) => ({
        value: cat.id,
        label: categoryDisplayName(cat),
        slug: cat.slug,
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [categories, locale],
  );

  // While we resolve the session/role (or redirect a guest/tradesman away), show
  // a spinner instead of the form so it never flashes for someone who can't post.
  if (!authzReady) {
    return (
      <div className="flex min-h-48 items-center justify-center">
        <Loader2
          className="size-6 animate-spin text-muted-foreground"
          aria-hidden
        />
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      <div className="space-y-1.5">
        <Label htmlFor="title">{t.fields.title}</Label>
        <Input
          id="title"
          placeholder={t.fields.titlePlaceholder}
          aria-invalid={errors.title !== undefined}
          {...register('title')}
        />
        {errors.title ? (
          <p className="text-xs text-destructive">{errors.title.message}</p>
        ) : null}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="description">{t.fields.description}</Label>
        <Textarea
          id="description"
          rows={5}
          placeholder={t.fields.descriptionPlaceholder}
          aria-invalid={errors.description !== undefined}
          {...register('description')}
        />
        {errors.description ? (
          <p className="text-xs text-destructive">
            {errors.description.message}
          </p>
        ) : null}
        <p className="text-xs text-muted-foreground">{t.new.ai.hint}</p>
      </div>

      {detection ? (
        <div className="flex flex-wrap items-center gap-2.5 rounded-lg bg-accent-soft px-3.5 py-3 text-sm text-accent-soft-foreground">
          <Sparkles className="size-4 shrink-0" aria-hidden />
          <span className="flex flex-wrap items-center gap-1.5">
            {t.new.ai.detected}{' '}
            <CategoryIcon
              slug={
                categories?.find((c) => c.id === detection.categoryId)?.slug
              }
              className="size-4"
            />
            <strong>
              {categories?.find((c) => c.id === detection.categoryId)?.nameEn ??
                ''}
            </strong>
            {detection.skills.length ? (
              <>
                {' · '}
                {t.new.ai.suggested}{' '}
                <strong>{detection.skills.join(', ')}</strong>
              </>
            ) : null}
          </span>
          <Badge variant="soft" className="ml-auto shrink-0">
            {t.new.ai.confidence.replace('{n}', String(detection.confidence))}
          </Badge>
          <p className="w-full text-xs text-accent-soft-foreground/80">
            {t.new.ai.disclaimer}
          </p>
        </div>
      ) : null}

      <div className="space-y-2">
        <Label>{t.new.photos.label}</Label>
        <div className="grid grid-cols-[repeat(auto-fill,minmax(96px,1fr))] gap-2.5">
          {photos.map((p) => (
            <div
              key={p.id}
              className="relative aspect-square overflow-hidden rounded-lg border border-border bg-muted"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.url} alt="" className="size-full object-cover" />
              <button
                type="button"
                onClick={() => removePhoto(p.id)}
                aria-label={t.new.photos.remove}
                className="absolute top-1.5 right-1.5 flex size-6 items-center justify-center rounded-full bg-black/60 text-white"
              >
                <X className="size-3.5" aria-hidden />
              </button>
            </div>
          ))}
          {photos.length < 8 ? (
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="flex aspect-square flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed border-border bg-muted text-xs font-semibold text-muted-foreground"
            >
              <Camera className="size-5" aria-hidden />
              {t.new.photos.add}
            </button>
          ) : null}
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          className="sr-only"
          onChange={(e) => {
            addPhotos(e.target.files);
            e.target.value = '';
          }}
        />
        <p className="text-xs text-muted-foreground">{t.new.photos.hint}</p>
      </div>

      <div className="space-y-2">
        <Label>
          {t.new.location.label}{' '}
          <span className="font-normal text-muted-foreground">
            {t.new.location.optional}
          </span>
        </Label>
        {!loc ? (
          <button
            type="button"
            onClick={shareLocation}
            disabled={locating}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-muted px-4 py-3.5 text-sm font-semibold text-muted-foreground"
          >
            {locating ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <MapPin className="size-4" aria-hidden />
            )}
            {locating ? t.new.location.getting : t.new.location.share}
          </button>
        ) : (
          <div className="relative h-40 overflow-hidden rounded-lg border border-border [background:repeating-linear-gradient(135deg,var(--muted)_0_8px,var(--background)_8px_16px)]">
            <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-full text-primary">
              <MapPin className="size-7" aria-hidden />
            </span>
            <span className="absolute bottom-3 left-3 rounded-md border border-border bg-background/90 px-2.5 py-1 font-mono text-[11px] font-semibold">
              {loc.lat.toFixed(4)}, {loc.lng.toFixed(4)}
            </span>
            <button
              type="button"
              onClick={() => setLoc(null)}
              aria-label={t.new.location.remove}
              className="absolute top-2.5 right-2.5 flex size-7 items-center justify-center rounded-full bg-black/60 text-white"
            >
              <X className="size-3.5" aria-hidden />
            </button>
          </div>
        )}
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Lock className="size-3" aria-hidden />
          {t.new.location.hint}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="category">{t.fields.category}</Label>
          <input type="hidden" {...register('categoryId')} />
          <Combobox
            id="category"
            aria-label={t.fields.category}
            items={categoryOptions}
            value={selectedCategoryId || null}
            onValueChange={(value) =>
              setValue('categoryId', value ?? '', {
                shouldDirty: true,
                shouldValidate: true,
              })
            }
            placeholder={t.fields.categoryPlaceholder}
            emptyText={t.fields.categoryEmpty}
            renderItem={(item) => (
              <>
                <CategoryIcon slug={item.slug} className="size-4 shrink-0" />
                <span className="truncate">{item.label}</span>
              </>
            )}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="urgency">{t.fields.urgency}</Label>
          <input type="hidden" {...register('urgency')} />
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  id="urgency"
                  variant="outline"
                  className="w-full justify-between"
                  aria-label={t.fields.urgency}
                >
                  <span className="truncate">{selectedUrgencyLabel}</span>
                  <ChevronDown className="size-4 opacity-60" />
                </Button>
              }
            />
            <DropdownMenuContent className="min-w-44">
              <DropdownMenuRadioGroup
                value={selectedUrgency}
                onValueChange={(value) =>
                  setValue('urgency', value as JobUrgency, {
                    shouldDirty: true,
                    shouldValidate: true,
                  })
                }
              >
                {URGENCY_OPTIONS.map((u) => (
                  <DropdownMenuRadioItem key={u} value={u}>
                    {t.urgencyLabels[u]}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="city">{t.fields.city}</Label>
          <Input id="city" {...register('city')} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="district">{t.fields.district}</Label>
          <input type="hidden" {...register('district')} />
          <Combobox
            id="district"
            aria-label={t.fields.district}
            items={DISTRICT_OPTIONS}
            value={watch('district') || null}
            onValueChange={(value) =>
              setValue('district', value ?? '', { shouldDirty: true })
            }
            placeholder={t.fields.districtPlaceholder}
            emptyText={t.fields.districtEmpty}
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="budgetMin">{t.fields.budgetMin}</Label>
          <Input
            id="budgetMin"
            type="number"
            min={0}
            step="0.01"
            {...register('budgetMin')}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="budgetMax">{t.fields.budgetMax}</Label>
          <Input
            id="budgetMax"
            type="number"
            min={0}
            step="0.01"
            aria-invalid={errors.budgetMax !== undefined}
            {...register('budgetMax')}
          />
          {errors.budgetMax ? (
            <p className="text-xs text-destructive">
              {errors.budgetMax.message}
            </p>
          ) : null}
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="scheduledFor">{t.fields.scheduledFor}</Label>
        <DatePicker
          id="scheduledFor"
          value={parseDateInput(watch('scheduledFor'))}
          onChange={(date) =>
            setValue('scheduledFor', formatDateInput(date), {
              shouldValidate: true,
            })
          }
          disabledDates={{ before: new Date() }}
        />
      </div>

      <Button type="submit" className="w-full" disabled={submitting}>
        {submitting ? t.new.submitting : t.new.submit}
      </Button>
    </form>
  );
}
