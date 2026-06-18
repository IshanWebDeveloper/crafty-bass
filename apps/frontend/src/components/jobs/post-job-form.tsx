'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery } from '@tanstack/react-query';
import { Button, Input } from '@repo/ui';
import { toast } from 'sonner';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { NativeSelect } from '@/components/ui/select';
import { createJob, type JobUrgency, type LanguageCode } from '@/lib/api/jobs';
import { listCategories } from '@/lib/api/categories';
import { ApiError } from '@/lib/api';
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

  const { data: categories } = useQuery({
    queryKey: ['categories'],
    queryFn: listCategories,
    staleTime: 5 * 60_000,
  });

  const {
    register,
    handleSubmit,
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
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="category">{t.fields.category}</Label>
          <NativeSelect id="category" {...register('categoryId')}>
            <option value="">{t.fields.categoryPlaceholder}</option>
            {categories?.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {categoryDisplayName(cat)}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="urgency">{t.fields.urgency}</Label>
          <NativeSelect id="urgency" {...register('urgency')}>
            {URGENCY_OPTIONS.map((u) => (
              <option key={u} value={u}>
                {t.urgencyLabels[u]}
              </option>
            ))}
          </NativeSelect>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="city">{t.fields.city}</Label>
          <Input id="city" {...register('city')} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="district">{t.fields.district}</Label>
          <Input id="district" {...register('district')} />
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
        <Input id="scheduledFor" type="date" {...register('scheduledFor')} />
      </div>

      <Button type="submit" className="w-full" disabled={submitting}>
        {submitting ? t.new.submitting : t.new.submit}
      </Button>
    </form>
  );
}
