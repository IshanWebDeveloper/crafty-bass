'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronDown } from 'lucide-react';
import {
  Button,
  Combobox,
  DatePicker,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
  Input,
  Skeleton,
} from '@repo/ui';
import { toast } from 'sonner';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { parseDateInput, formatDateInput } from '@/lib/date';
import {
  getJob,
  updateJob,
  type Job,
  type JobUrgency,
  type TaskSize,
  type UpdateJobBody,
  type VehicleRequirement,
} from '@/lib/api/jobs';
import { listCategories } from '@/lib/api/categories';
import { CategoryIcon } from '@/lib/categories';
import { DISTRICT_OPTIONS } from '@/lib/districts';
import { ApiError } from '@/lib/api';
import type { Locale } from '@/i18n/config';
import type { Dictionary } from '@/i18n/dictionaries';
import { RadioCards } from './post-job-form';

const URGENCY_OPTIONS: JobUrgency[] = ['LOW', 'MEDIUM', 'HIGH', 'EMERGENCY'];
const TASK_SIZE_OPTIONS: TaskSize[] = ['SMALL', 'MEDIUM', 'LARGE'];
const VEHICLE_OPTIONS: VehicleRequirement[] = ['NONE', 'CAR', 'TRUCK'];

const EditJobSchema = z
  .object({
    title: z.string().trim().min(3).max(160),
    description: z.string().trim().min(10).max(5000),
    categoryId: z.string().optional(),
    urgency: z.enum(URGENCY_OPTIONS),
    city: z.string().trim().max(80).optional(),
    district: z.string().trim().max(80).optional(),
    budgetMin: z.string().optional(),
    budgetMax: z.string().optional(),
    scheduledFor: z.string().optional(),
    taskSize: z.enum(TASK_SIZE_OPTIONS).optional(),
    vehicleRequirement: z.enum(VEHICLE_OPTIONS).optional(),
  })
  .refine(
    (v) => {
      if (!v.budgetMin || !v.budgetMax) return true;
      return Number(v.budgetMax) >= Number(v.budgetMin);
    },
    { message: 'Max must be ≥ min', path: ['budgetMax'] },
  );

type EditJobValues = z.infer<typeof EditJobSchema>;

function parseOptionalNumber(value: string | undefined) {
  if (value === undefined || value === '') return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

// The stored job → the form's string-shaped values. Numbers become strings (the
// <input> shape) and the ISO scheduledFor becomes the `yyyy-MM-dd` the DatePicker
// bridge expects. Only ever called once the job has loaded.
function toFormValues(job: Job): EditJobValues {
  return {
    title: job.title,
    description: job.description,
    categoryId: job.category?.id ?? '',
    urgency: job.urgency,
    city: job.city ?? '',
    district: job.district ?? '',
    budgetMin: job.budgetMin != null ? String(job.budgetMin) : '',
    budgetMax: job.budgetMax != null ? String(job.budgetMax) : '',
    scheduledFor: job.scheduledFor
      ? formatDateInput(new Date(job.scheduledFor))
      : '',
    taskSize: job.taskSize ?? undefined,
    vehicleRequirement: job.vehicleRequirement ?? undefined,
  };
}

export function EditJobForm({
  locale,
  dict,
  jobId,
}: {
  locale: Locale;
  dict: Dictionary;
  jobId: string;
}) {
  const router = useRouter();
  const qc = useQueryClient();
  const t = dict.jobs;

  const { data: job, isLoading } = useQuery({
    queryKey: ['job', jobId],
    queryFn: () => getJob(jobId),
  });

  const { data: categories } = useQuery({
    queryKey: ['categories'],
    queryFn: listCategories,
  });

  const categoryDisplayName = (category: {
    nameEn: string;
    nameSi: string | null;
    nameTa: string | null;
  }) => {
    if (locale === 'si' && category.nameSi) return category.nameSi;
    if (locale === 'ta' && category.nameTa) return category.nameTa;
    return category.nameEn;
  };

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

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<EditJobValues>({
    resolver: zodResolver(EditJobSchema),
    // `values` keeps the form in sync once the async job load resolves; it stays
    // undefined (no reset) until then.
    values: job ? toFormValues(job) : undefined,
  });

  const updateMutation = useMutation({
    mutationFn: (body: UpdateJobBody) => updateJob(jobId, body),
    onSuccess: () => {
      toast.success(t.edit.success);
      qc.invalidateQueries({ queryKey: ['job', jobId] });
      qc.invalidateQueries({ queryKey: ['jobs', 'mine'] });
      router.push(`/${locale}/jobs/${jobId}`);
    },
    onError: (err) => {
      toast.error(err instanceof ApiError ? err.message : t.edit.error);
    },
  });

  function onSubmit(values: EditJobValues) {
    updateMutation.mutate({
      title: values.title,
      description: values.description,
      categoryId: values.categoryId ? values.categoryId : null,
      urgency: values.urgency,
      city: values.city || undefined,
      district: values.district || undefined,
      budgetMin: parseOptionalNumber(values.budgetMin),
      budgetMax: parseOptionalNumber(values.budgetMax),
      scheduledFor: values.scheduledFor || undefined,
      taskSize: values.taskSize,
      vehicleRequirement: values.vehicleRequirement,
    });
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-9 w-1/2" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-9 w-full" />
      </div>
    );
  }

  if (!job) {
    return <p className="text-sm text-muted-foreground">{t.edit.notFound}</p>;
  }

  // Only an open job can be edited (mirrors the backend guard). Anything else
  // gets a clear message and a way back rather than a form that would 403.
  if (job.status !== 'OPEN') {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">{t.edit.notEditable}</p>
        <Button
          variant="outline"
          render={<Link href={`/${locale}/jobs/${jobId}`} />}
        >
          {t.edit.back}
        </Button>
      </div>
    );
  }

  const selectedCategoryId = watch('categoryId');
  const selectedUrgency = watch('urgency');
  const selectedUrgencyLabel = selectedUrgency
    ? t.urgencyLabels[selectedUrgency]
    : '';

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

      <RadioCards
        label={t.fields.taskSize}
        optional={t.fields.optional}
        options={TASK_SIZE_OPTIONS}
        value={watch('taskSize')}
        onChange={(value) => setValue('taskSize', value, { shouldDirty: true })}
        getLabel={(option) => t.taskSizeLabels[option]}
        getHint={(option) => t.taskSizeHints[option]}
      />

      <RadioCards
        label={t.fields.vehicle}
        optional={t.fields.optional}
        options={VEHICLE_OPTIONS}
        value={watch('vehicleRequirement')}
        onChange={(value) =>
          setValue('vehicleRequirement', value, { shouldDirty: true })
        }
        getLabel={(option) => t.vehicleLabels[option]}
        getHint={(option) => t.vehicleHints[option]}
      />

      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={updateMutation.isPending}>
          {updateMutation.isPending ? t.edit.saving : t.edit.save}
        </Button>
        <Button
          type="button"
          variant="outline"
          render={<Link href={`/${locale}/jobs/${jobId}`} />}
        >
          {t.edit.back}
        </Button>
      </div>
    </form>
  );
}
