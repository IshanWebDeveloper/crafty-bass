'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Button,
  Combobox,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
  Input,
  cn,
  tagVariants,
} from '@repo/ui';
import { ChevronDown } from 'lucide-react';
import { toast } from 'sonner';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  upsertTradesmanProfile,
  listSkills,
  type TradesmanProfile,
  type LanguageCode,
} from '@/lib/api/profiles';
import { DISTRICT_OPTIONS } from '@/lib/districts';
import type { Dictionary } from '@/i18n/dictionaries';

const LANGUAGE_OPTIONS: LanguageCode[] = ['EN', 'SI', 'TA'];

const TradesmanSchema = z.object({
  bio: z.string().trim().max(2000).optional(),
  yearsExperience: z
    .string()
    .min(1)
    .refine((v) => Number.isFinite(Number(v)) && Number(v) >= 0, {
      message: 'Must be ≥ 0',
    }),
  hourlyRate: z.string().optional(),
  serviceRadiusKm: z
    .string()
    .min(1)
    .refine((v) => Number.isFinite(Number(v)) && Number(v) >= 0, {
      message: 'Must be ≥ 0',
    }),
  locationText: z.string().trim().max(200).optional(),
  city: z.string().trim().max(80).optional(),
  district: z.string().trim().max(80).optional(),
  preferredLanguage: z.enum(LANGUAGE_OPTIONS),
  // Edited as newline-separated text; split into arrays on submit.
  certifications: z.string().max(5000).optional(),
  vehicles: z.string().max(2500).optional(),
});
type TradesmanValues = z.infer<typeof TradesmanSchema>;

/** Split a newline-separated textarea value into a trimmed, non-empty list. */
function toLines(value: string | undefined): string[] {
  return (value ?? '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

export function TradesmanProfileForm({
  initial,
  dict,
}: {
  initial: TradesmanProfile | null;
  dict: Dictionary;
}) {
  const qc = useQueryClient();
  const t = dict.profile;
  const [submitting, setSubmitting] = useState(false);
  const [selectedSkillIds, setSelectedSkillIds] = useState<Set<string>>(
    () => new Set(initial?.skills.map((s) => s.skillId) ?? []),
  );

  const { data: skills } = useQuery({
    queryKey: ['skills'],
    queryFn: () => listSkills(),
    staleTime: 5 * 60_000,
  });

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<TradesmanValues>({
    resolver: zodResolver(TradesmanSchema),
    defaultValues: {
      bio: initial?.bio ?? '',
      yearsExperience: String(initial?.yearsExperience ?? 0),
      hourlyRate:
        initial?.hourlyRate !== null && initial?.hourlyRate !== undefined
          ? String(initial.hourlyRate)
          : '',
      serviceRadiusKm: String(initial?.serviceRadiusKm ?? 15),
      locationText: initial?.locationText ?? '',
      city: initial?.city ?? '',
      district: initial?.district ?? '',
      preferredLanguage: initial?.preferredLanguage ?? 'EN',
      certifications: (initial?.certifications ?? []).join('\n'),
      vehicles: (initial?.vehicles ?? []).join('\n'),
    },
  });
  const selectedLanguage = watch('preferredLanguage');

  const mutation = useMutation({
    mutationFn: (values: TradesmanValues) =>
      upsertTradesmanProfile({
        preferredLanguage: values.preferredLanguage,
        yearsExperience: Number(values.yearsExperience),
        serviceRadiusKm: Number(values.serviceRadiusKm),
        bio: values.bio || undefined,
        hourlyRate:
          values.hourlyRate && values.hourlyRate !== ''
            ? Number(values.hourlyRate)
            : undefined,
        locationText: values.locationText || undefined,
        city: values.city || undefined,
        district: values.district || undefined,
        skillIds: Array.from(selectedSkillIds),
        certifications: toLines(values.certifications),
        vehicles: toLines(values.vehicles),
      }),
    onSuccess: () => {
      toast.success(t.saved);
      void qc.invalidateQueries({ queryKey: ['profile', 'me'] });
    },
    onError: (err) =>
      toast.error(err instanceof Error ? err.message : 'Could not save'),
  });

  async function onSubmit(values: TradesmanValues) {
    setSubmitting(true);
    try {
      await mutation.mutateAsync(values);
    } finally {
      setSubmitting(false);
    }
  }

  function toggleSkill(skillId: string, on: boolean) {
    setSelectedSkillIds((prev) => {
      const next = new Set(prev);
      if (on) next.add(skillId);
      else next.delete(skillId);
      return next;
    });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="bio">{t.tradesman.bio}</Label>
        <Textarea
          id="bio"
          rows={4}
          placeholder={t.tradesman.bioPlaceholder}
          {...register('bio')}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="yearsExperience">{t.tradesman.yearsExperience}</Label>
          <Input
            id="yearsExperience"
            type="number"
            min={0}
            aria-invalid={errors.yearsExperience !== undefined}
            {...register('yearsExperience')}
          />
          {errors.yearsExperience ? (
            <p className="text-xs text-destructive">
              {errors.yearsExperience.message}
            </p>
          ) : null}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="hourlyRate">{t.tradesman.hourlyRate}</Label>
          <Input
            id="hourlyRate"
            type="number"
            min={0}
            step="0.01"
            {...register('hourlyRate')}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="serviceRadiusKm">{t.tradesman.serviceRadiusKm}</Label>
          <Input
            id="serviceRadiusKm"
            type="number"
            min={0}
            {...register('serviceRadiusKm')}
          />
          {errors.serviceRadiusKm ? (
            <p className="text-xs text-destructive">
              {errors.serviceRadiusKm.message}
            </p>
          ) : null}
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="locationText">{t.fields.locationText}</Label>
        <Input id="locationText" {...register('locationText')} />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
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

      <div className="space-y-2">
        <div>
          <Label>{t.tradesman.skills}</Label>
          <p className="text-xs text-muted-foreground">
            {t.tradesman.skillsHelp}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 rounded-lg border border-border p-3">
          {skills?.map((skill) => {
            const checked = selectedSkillIds.has(skill.id);
            return (
              <button
                key={skill.id}
                type="button"
                aria-pressed={checked}
                onClick={() => toggleSkill(skill.id, !checked)}
                className={cn(
                  tagVariants({ variant: checked ? 'active' : 'default' }),
                  'cursor-pointer rounded-md px-2.5 py-1.5 transition-colors',
                )}
              >
                {skill.nameEn}
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="certifications">{t.tradesman.certifications}</Label>
        <Textarea
          id="certifications"
          rows={3}
          placeholder={t.tradesman.certificationsPlaceholder}
          {...register('certifications')}
        />
        <p className="text-xs text-muted-foreground">
          {t.tradesman.certificationsHint}
        </p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="vehicles">{t.tradesman.vehicles}</Label>
        <Textarea
          id="vehicles"
          rows={2}
          placeholder={t.tradesman.vehiclesPlaceholder}
          {...register('vehicles')}
        />
        <p className="text-xs text-muted-foreground">
          {t.tradesman.vehiclesHint}
        </p>
      </div>

      <Button type="submit" className="w-full" disabled={submitting}>
        {submitting ? t.tradesman.submitting : t.tradesman.submit}
      </Button>
    </form>
  );
}
