'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Button,
  Combobox,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
  Input,
} from '@repo/ui';
import { ChevronDown } from 'lucide-react';
import { toast } from 'sonner';
import { Label } from '@/components/ui/label';
import {
  upsertHomeownerProfile,
  type HomeownerProfile,
  type LanguageCode,
} from '@/lib/api/profiles';
import { DISTRICT_OPTIONS } from '@/lib/districts';
import type { Dictionary } from '@/i18n/dictionaries';

const LANGUAGE_OPTIONS: LanguageCode[] = ['EN', 'SI', 'TA'];

const HomeownerSchema = z.object({
  locationText: z.string().trim().max(200).optional(),
  city: z.string().trim().max(80).optional(),
  district: z.string().trim().max(80).optional(),
  postalCode: z.string().trim().max(20).optional(),
  preferredLanguage: z.enum(LANGUAGE_OPTIONS),
});
type HomeownerValues = z.infer<typeof HomeownerSchema>;

export function HomeownerProfileForm({
  initial,
  dict,
}: {
  initial: HomeownerProfile | null;
  dict: Dictionary;
}) {
  const qc = useQueryClient();
  const t = dict.profile;
  const [submitting, setSubmitting] = useState(false);
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<HomeownerValues>({
    resolver: zodResolver(HomeownerSchema),
    defaultValues: {
      locationText: initial?.locationText ?? '',
      city: initial?.city ?? '',
      district: initial?.district ?? '',
      postalCode: initial?.postalCode ?? '',
      preferredLanguage: initial?.preferredLanguage ?? 'EN',
    },
  });
  const selectedLanguage = watch('preferredLanguage');

  const mutation = useMutation({
    mutationFn: (values: HomeownerValues) =>
      upsertHomeownerProfile({
        preferredLanguage: values.preferredLanguage,
        locationText: values.locationText || undefined,
        city: values.city || undefined,
        district: values.district || undefined,
        postalCode: values.postalCode || undefined,
      }),
    onSuccess: () => {
      toast.success(t.saved);
      void qc.invalidateQueries({ queryKey: ['profile', 'me'] });
    },
    onError: (err) =>
      toast.error(err instanceof Error ? err.message : 'Could not save'),
  });

  async function onSubmit(values: HomeownerValues) {
    setSubmitting(true);
    try {
      await mutation.mutateAsync(values);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="locationText">{t.fields.locationText}</Label>
        <Input id="locationText" {...register('locationText')} />
        {errors.locationText ? (
          <p className="text-xs text-destructive">
            {errors.locationText.message}
          </p>
        ) : null}
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
          <Label htmlFor="postalCode">{t.fields.postalCode}</Label>
          <Input id="postalCode" {...register('postalCode')} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="preferredLanguage">
            {t.fields.preferredLanguage}
          </Label>
          <input type="hidden" {...register('preferredLanguage')} />
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  id="preferredLanguage"
                  variant="outline"
                  className="w-full justify-between"
                  aria-label={t.fields.preferredLanguage}
                >
                  <span className="truncate">
                    {t.languages[selectedLanguage]}
                  </span>
                  <ChevronDown className="size-4 opacity-60" />
                </Button>
              }
            />
            <DropdownMenuContent className="min-w-44">
              <DropdownMenuRadioGroup
                value={selectedLanguage}
                onValueChange={(value) =>
                  setValue('preferredLanguage', value as LanguageCode, {
                    shouldDirty: true,
                    shouldValidate: true,
                  })
                }
              >
                {LANGUAGE_OPTIONS.map((l) => (
                  <DropdownMenuRadioItem key={l} value={l}>
                    {t.languages[l]}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      <Button type="submit" className="w-full" disabled={submitting}>
        {submitting ? t.homeowner.submitting : t.homeowner.submit}
      </Button>
    </form>
  );
}
