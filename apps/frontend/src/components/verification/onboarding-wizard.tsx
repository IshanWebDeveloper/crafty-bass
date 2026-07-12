'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Award,
  Check,
  CheckCircle2,
  Clock,
  CreditCard,
  FileBadge,
  ImagePlus,
  Loader2,
  Lock,
  ShieldCheck,
  UserRound,
  X,
} from 'lucide-react';
import {
  Badge,
  Button,
  Combobox,
  DatePicker,
  Input,
  buttonVariants,
  cn,
} from '@repo/ui';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@repo/ui';
import { ChevronDown } from 'lucide-react';
import { toast } from 'sonner';
import { parseDateInput, formatDateInput } from '@/lib/date';
import { DISTRICT_OPTIONS } from '@/lib/districts';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { VerifiedBadge } from '@repo/ui';
import {
  getMyVerification,
  submitVerification,
  type SubmitVerificationBody,
} from '@/lib/api/verification';
import { uploadFile, type UploadCategory } from '@/lib/api/uploads';
import {
  listSkills,
  upsertTradesmanProfile,
  type Skill,
} from '@/lib/api/profiles';
import { SkillsPicker } from '@/components/profile/skills-picker';
import type { Locale } from '@/i18n/config';
import type { Dictionary } from '@/i18n/dictionaries';

const BANKS = [
  'Bank of Ceylon',
  "People's Bank",
  'Commercial Bank',
  'Sampath Bank',
  'Hatton National Bank',
  'Nations Trust Bank',
];

// Date-of-birth picker bounds: today back to 100 years ago, so the year
// dropdown spans a realistic range instead of paging month by month.
const DOB_MAX = new Date();
const DOB_MIN = new Date(DOB_MAX.getFullYear() - 100, 0);

type Form = {
  fullName: string;
  gender: string;
  dateOfBirth: string;
  nicNumber: string;
  addressLine: string;
  city: string;
  district: string;
  primaryTrade: string;
  yearsExperience: string;
  // skills — catalog picks (Skill ids) plus free-text skills the tradesman typed
  skillIds: string[];
  customSkills: string[];
  // documents — each holds the uploaded R2 object key (null until uploaded)
  nicFront: string | null;
  nicBack: string | null;
  photo: string | null;
  gramaNiladhari: string | null;
  licence: string | null;
  licenceNumber: string;
  policeClearance: string | null;
  // work photos — array of uploaded R2 object keys
  portfolio: string[];
  // details
  serviceRadiusKm: number;
  crewType: 'solo' | 'team';
  helperCount: string;
  guarantorName: string;
  guarantorNic: string;
  // payout
  payoutAccountHolder: string;
  payoutBank: string;
  payoutBranch: string;
  payoutAccountNumber: string;
  consent: boolean;
};

// The single-file document fields (each stores an uploaded R2 key).
type DocField =
  | 'nicFront'
  | 'nicBack'
  | 'photo'
  | 'gramaNiladhari'
  | 'licence'
  | 'policeClearance';

// Upload wiring threaded into the Documents/Details steps.
type UploadHandlers = {
  previews: Record<string, string>;
  uploading: Record<string, boolean>;
  onFile: (
    field: DocField,
    category: UploadCategory,
    file: File | null,
  ) => void;
  addPortfolio: (files: FileList | null) => void;
  removePortfolio: (key: string) => void;
};

const EMPTY: Form = {
  fullName: '',
  gender: '',
  dateOfBirth: '',
  nicNumber: '',
  addressLine: '',
  city: '',
  district: '',
  primaryTrade: '',
  yearsExperience: '',
  skillIds: [],
  customSkills: [],
  nicFront: null,
  nicBack: null,
  photo: null,
  gramaNiladhari: null,
  licence: null,
  licenceNumber: '',
  policeClearance: null,
  portfolio: [],
  serviceRadiusKm: 15,
  crewType: 'solo',
  helperCount: '',
  guarantorName: '',
  guarantorNic: '',
  payoutAccountHolder: '',
  payoutBank: BANKS[0],
  payoutBranch: '',
  payoutAccountNumber: '',
  consent: false,
};

export function OnboardingWizard({
  locale,
  dict,
}: {
  locale: Locale;
  dict: Dictionary;
}) {
  const qc = useQueryClient();
  const tv = dict.verification;
  const t = dict.onboarding;
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<Form>(EMPTY);

  const { data: existing } = useQuery({
    queryKey: ['verification', 'me'],
    queryFn: getMyVerification,
    retry: false,
    staleTime: 30_000,
  });

  const { data: skills } = useQuery({
    queryKey: ['skills'],
    queryFn: () => listSkills(),
    staleTime: 5 * 60_000,
  });

  const set = <K extends keyof Form>(key: K, value: Form[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  // Per-field upload state: presigned preview URLs (keyed by field name for the
  // single documents, and by object key for portfolio images) and in-flight
  // flags so tiles can show a spinner while a file uploads.
  const [previews, setPreviews] = useState<Record<string, string>>({});
  const [uploading, setUploading] = useState<Record<string, boolean>>({});

  async function handleUpload(
    field: DocField,
    category: UploadCategory,
    file: File | null,
  ) {
    if (!file) return;
    setUploading((u) => ({ ...u, [field]: true }));
    try {
      const { key, url } = await uploadFile(file, category);
      set(field, key);
      setPreviews((p) => ({ ...p, [field]: url }));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading((u) => ({ ...u, [field]: false }));
    }
  }

  async function addPortfolio(files: FileList | null) {
    if (!files || files.length === 0) return;
    const chosen = Array.from(files).slice(0, 10 - form.portfolio.length);
    setUploading((u) => ({ ...u, portfolio: true }));
    for (const file of chosen) {
      try {
        const { key, url } = await uploadFile(file, 'portfolio');
        setForm((f) => ({ ...f, portfolio: [...f.portfolio, key] }));
        setPreviews((p) => ({ ...p, [key]: url }));
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Upload failed');
      }
    }
    setUploading((u) => ({ ...u, portfolio: false }));
  }

  const removePortfolio = (key: string) =>
    setForm((f) => ({ ...f, portfolio: f.portfolio.filter((k) => k !== key) }));

  const up: UploadHandlers = {
    previews,
    uploading,
    onFile: handleUpload,
    addPortfolio,
    removePortfolio,
  };

  const mutation = useMutation({
    mutationFn: async () => {
      const body: SubmitVerificationBody = {
        fullName: form.fullName,
        gender: form.gender || undefined,
        dateOfBirth: form.dateOfBirth || undefined,
        nicNumber: form.nicNumber,
        addressLine: form.addressLine || undefined,
        city: form.city || undefined,
        district: form.district || undefined,
        primaryTrade: form.primaryTrade || undefined,
        yearsExperience: form.yearsExperience
          ? Number(form.yearsExperience)
          : undefined,
        nicFrontKey: form.nicFront ?? undefined,
        nicBackKey: form.nicBack ?? undefined,
        photoKey: form.photo ?? undefined,
        gramaNiladhariKey: form.gramaNiladhari ?? undefined,
        licenceKey: form.licence ?? undefined,
        licenceNumber: form.licenceNumber || undefined,
        policeClearanceKey: form.policeClearance ?? undefined,
        portfolioKeys: form.portfolio.length ? form.portfolio : undefined,
        serviceRadiusKm: form.serviceRadiusKm,
        crewType: form.crewType,
        helperCount:
          form.crewType === 'team' && form.helperCount
            ? Number(form.helperCount)
            : undefined,
        guarantorName: form.guarantorName || undefined,
        guarantorNic: form.guarantorNic || undefined,
        payoutAccountHolder: form.payoutAccountHolder || undefined,
        payoutBank: form.payoutBank || undefined,
        payoutBranch: form.payoutBranch || undefined,
        payoutAccountNumber: form.payoutAccountNumber || undefined,
      };
      await submitVerification(body);
      // Skills live on the tradesman profile, not the verification record, so
      // persist them here. This creates the profile early (unverified); the
      // reviewer's approval later only flips isVerified and won't touch skills.
      if (form.skillIds.length || form.customSkills.length) {
        await upsertTradesmanProfile({
          preferredLanguage: 'EN',
          yearsExperience: form.yearsExperience
            ? Number(form.yearsExperience)
            : 0,
          serviceRadiusKm: form.serviceRadiusKm,
          city: form.city || undefined,
          district: form.district || undefined,
          skillIds: form.skillIds,
          skillNames: form.customSkills,
        });
      }
    },
    onSuccess: () => {
      toast.success(tv.submitted);
      void qc.invalidateQueries({ queryKey: ['verification', 'me'] });
      void qc.invalidateQueries({ queryKey: ['profiles', 'me'] });
      setStep(STAGES.length); // submitted screen
    },
    onError: (err) =>
      toast.error(err instanceof Error ? err.message : 'Failed to submit'),
  });

  const STAGES = t.stages;
  const isSubmitted = step >= STAGES.length;

  // Already approved → show a done state instead of the form.
  if (existing?.status === 'APPROVED' && step < STAGES.length) {
    return <Submitted dict={dict} locale={locale} approved />;
  }

  if (isSubmitted || mutation.isSuccess) {
    return (
      <Submitted
        dict={dict}
        locale={locale}
        police={Boolean(form.policeClearance)}
      />
    );
  }

  // Each step must be completed before advancing (previously only step 0 was
  // gated, so a tradesman could click through documents/details/payout empty).
  const stepValid = (s: number): boolean => {
    switch (s) {
      case 0:
        return Boolean(
          form.fullName.trim() &&
          form.nicNumber.trim() &&
          form.primaryTrade.trim(),
        );
      case 1:
        // Core identity documents must be uploaded.
        return Boolean(form.nicFront && form.nicBack && form.photo);
      case 2:
        // A team must say how many helpers; solo is always fine.
        return form.crewType === 'solo' || Boolean(form.helperCount.trim());
      case 3:
        return Boolean(
          form.payoutAccountHolder.trim() &&
          form.payoutBranch.trim() &&
          form.payoutAccountNumber.trim() &&
          form.consent,
        );
      default:
        return true;
    }
  };
  const canContinue = stepValid(step);
  const isLast = step === STAGES.length - 1;

  return (
    <div className="space-y-8">
      <Rail stages={STAGES} current={step} />

      {existing?.status === 'REJECTED' ? (
        <div className="rounded-lg bg-warning-subtle px-4 py-3 text-sm text-warning-foreground">
          <span className="font-semibold">{t.rejected.heading}</span>
          {existing.rejectionReason ? ` — ${existing.rejectionReason}` : ''}
        </div>
      ) : null}

      {step === 0 ? (
        <Profile t={t} tv={tv} form={form} set={set} skills={skills} />
      ) : step === 1 ? (
        <Documents t={t} tv={tv} form={form} set={set} up={up} />
      ) : step === 2 ? (
        <Details t={t} form={form} set={set} up={up} />
      ) : (
        <Payout t={t} tv={tv} form={form} set={set} />
      )}

      <div className="flex items-center gap-3 border-t border-border pt-5">
        {step > 0 ? (
          <Button variant="ghost" onClick={() => setStep((s) => s - 1)}>
            <ArrowLeft className="size-4" aria-hidden />
            {t.back}
          </Button>
        ) : (
          <span />
        )}
        <span className="flex-1 text-xs text-muted-foreground">
          {!canContinue
            ? t.completeFields
            : t.stepOf
                .replace('{current}', String(step + 1))
                .replace('{total}', String(STAGES.length))}
        </span>
        {isLast ? (
          <Button
            onClick={() => mutation.mutate()}
            disabled={!canContinue || mutation.isPending}
          >
            {mutation.isPending ? t.submitting : t.submit}
          </Button>
        ) : (
          <Button onClick={() => setStep((s) => s + 1)} disabled={!canContinue}>
            {t.continue}
          </Button>
        )}
      </div>
    </div>
  );
}

function Rail({ stages, current }: { stages: string[]; current: number }) {
  return (
    <ol className="flex flex-wrap items-center justify-center gap-y-2">
      {stages.map((s, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <li key={s} className="flex items-center">
            <span className="inline-flex items-center gap-2">
              <span
                className={cn(
                  'inline-flex size-6 items-center justify-center rounded-full font-mono text-[11px] font-semibold',
                  done && 'bg-success text-success-foreground',
                  active && 'bg-primary text-primary-foreground',
                  !done &&
                    !active &&
                    'border border-border bg-muted text-muted-foreground',
                )}
              >
                {done ? <Check className="size-3.5" aria-hidden /> : i + 1}
              </span>
              <span
                className={cn(
                  'text-sm',
                  active
                    ? 'font-semibold text-foreground'
                    : 'font-medium text-muted-foreground',
                )}
              >
                {s}
              </span>
            </span>
            {i < stages.length - 1 ? (
              <span
                className={cn(
                  'mx-2.5 h-px w-5',
                  done ? 'bg-success' : 'bg-border',
                )}
              />
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}

function StepHead({ title, sub }: { title: string; sub: string }) {
  return (
    <div>
      <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
      <p className="mt-1.5 max-w-lg text-sm text-muted-foreground">{sub}</p>
    </div>
  );
}

type StepProps = {
  t: Dictionary['onboarding'];
  tv: Dictionary['verification'];
  form: Form;
  set: <K extends keyof Form>(key: K, value: Form[K]) => void;
};

// Steps that upload files also receive the upload handlers.
type UploadStepProps = StepProps & { up: UploadHandlers };

// KYC documents accept images or a PDF scan.
const KYC_ACCEPT = 'image/jpeg,image/png,image/webp,application/pdf';

function Profile({
  t,
  tv,
  form,
  set,
  skills,
}: StepProps & { skills: Skill[] | undefined }) {
  return (
    <div className="space-y-5">
      <StepHead title={t.profile.title} sub={t.profile.sub} />
      <div className="space-y-1.5">
        <Label htmlFor="o-name">{tv.fields.fullName}</Label>
        <Input
          id="o-name"
          value={form.fullName}
          onChange={(e) => set('fullName', e.target.value)}
          autoComplete="name"
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="o-nic" className="inline-flex items-center gap-1.5">
            {tv.fields.nic}
            <Lock className="size-3 text-muted-foreground" aria-hidden />
          </Label>
          <Input
            id="o-nic"
            value={form.nicNumber}
            onChange={(e) => set('nicNumber', e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="o-dob">{tv.fields.dob}</Label>
          <DatePicker
            id="o-dob"
            value={parseDateInput(form.dateOfBirth)}
            onChange={(date) => set('dateOfBirth', formatDateInput(date))}
            captionLayout="dropdown"
            startMonth={DOB_MIN}
            endMonth={DOB_MAX}
            disabledDates={{ after: DOB_MAX }}
          />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="o-trade">{t.profile.trade}</Label>
          <Input
            id="o-trade"
            value={form.primaryTrade}
            onChange={(e) => set('primaryTrade', e.target.value)}
            placeholder="Plumbing"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="o-district">{t.profile.district}</Label>
          <Combobox
            id="o-district"
            aria-label={t.profile.district}
            items={DISTRICT_OPTIONS}
            value={form.district || null}
            onValueChange={(value) => set('district', value ?? '')}
            placeholder={t.profile.district}
            emptyText={t.profile.districtEmpty}
          />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="o-address">{tv.fields.address}</Label>
        <Input
          id="o-address"
          value={form.addressLine}
          onChange={(e) => set('addressLine', e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <div>
          <Label>{t.profile.skills}</Label>
          <p className="text-xs text-muted-foreground">
            {t.profile.skillsHelp}
          </p>
        </div>
        <SkillsPicker
          skills={skills}
          selectedIds={new Set(form.skillIds)}
          onToggleId={(id, on) =>
            set(
              'skillIds',
              on
                ? [...form.skillIds, id]
                : form.skillIds.filter((x) => x !== id),
            )
          }
          customSkills={form.customSkills}
          onAddCustom={(name) =>
            set('customSkills', [...form.customSkills, name])
          }
          onRemoveCustom={(name) =>
            set(
              'customSkills',
              form.customSkills.filter((x) => x !== name),
            )
          }
          searchPlaceholder={t.profile.skillsSearchPlaceholder}
          createLabel={t.profile.skillsCreate}
          emptyText={t.profile.skillsEmpty}
        />
      </div>
    </div>
  );
}

function DocTile({
  icon: Icon,
  name,
  value,
  previewUrl,
  uploading,
  sensitive,
  onFile,
  providedLabel,
  uploadLabel,
}: {
  icon: typeof CreditCard;
  name: string;
  value: string | null;
  previewUrl?: string;
  uploading: boolean;
  sensitive?: boolean;
  onFile: (file: File | null) => void;
  providedLabel: string;
  uploadLabel: string;
}) {
  const done = Boolean(value);
  return (
    <label
      className={cn(
        'flex w-full cursor-pointer items-center gap-3.5 rounded-lg border p-3.5 text-left transition-colors',
        done
          ? 'border-success bg-accent-soft'
          : 'border-dashed border-border bg-muted hover:bg-muted/70',
        uploading && 'pointer-events-none opacity-70',
      )}
    >
      <input
        type="file"
        accept={KYC_ACCEPT}
        className="sr-only"
        onChange={(e) => onFile(e.target.files?.[0] ?? null)}
      />
      <span
        className={cn(
          'inline-flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-md',
          done
            ? 'bg-success text-success-foreground'
            : 'border border-border bg-background text-muted-foreground',
        )}
      >
        {uploading ? (
          <Loader2 className="size-5 animate-spin" aria-hidden />
        ) : previewUrl ? (
          // Presigned R2 URL — plain img avoids next/image remotePatterns config.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={previewUrl} alt="" className="size-full object-cover" />
        ) : done ? (
          <Check className="size-5" aria-hidden />
        ) : (
          <Icon className="size-5" aria-hidden />
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5 text-sm font-semibold">
          {name}
          {sensitive ? (
            <Lock className="size-3 text-muted-foreground" aria-hidden />
          ) : null}
        </span>
        <span className="mt-0.5 block truncate text-xs text-muted-foreground">
          {done ? providedLabel : uploadLabel}
        </span>
      </span>
    </label>
  );
}

function Documents({ t, tv, form, up }: UploadStepProps) {
  const td = t.documents;
  return (
    <div className="space-y-5">
      <StepHead title={td.title} sub={td.sub} />
      <div className="grid gap-3 sm:grid-cols-2">
        <DocTile
          icon={CreditCard}
          name={tv.fields.nicFront}
          value={form.nicFront}
          previewUrl={up.previews.nicFront}
          uploading={Boolean(up.uploading.nicFront)}
          sensitive
          onFile={(file) => up.onFile('nicFront', 'kyc', file)}
          providedLabel={td.provided}
          uploadLabel={tv.upload.cta}
        />
        <DocTile
          icon={CreditCard}
          name={tv.fields.nicBack}
          value={form.nicBack}
          previewUrl={up.previews.nicBack}
          uploading={Boolean(up.uploading.nicBack)}
          sensitive
          onFile={(file) => up.onFile('nicBack', 'kyc', file)}
          providedLabel={td.provided}
          uploadLabel={tv.upload.cta}
        />
        <DocTile
          icon={UserRound}
          name={tv.fields.photo}
          value={form.photo}
          previewUrl={up.previews.photo}
          uploading={Boolean(up.uploading.photo)}
          sensitive
          onFile={(file) => up.onFile('photo', 'kyc', file)}
          providedLabel={td.provided}
          uploadLabel={tv.upload.cta}
        />
        <DocTile
          icon={FileBadge}
          name={td.gramaNiladhari}
          value={form.gramaNiladhari}
          previewUrl={up.previews.gramaNiladhari}
          uploading={Boolean(up.uploading.gramaNiladhari)}
          sensitive
          onFile={(file) => up.onFile('gramaNiladhari', 'kyc', file)}
          providedLabel={td.provided}
          uploadLabel={tv.upload.cta}
        />
        <div className="sm:col-span-2">
          <DocTile
            icon={Award}
            name={tv.fields.licence}
            value={form.licence}
            previewUrl={up.previews.licence}
            uploading={Boolean(up.uploading.licence)}
            onFile={(file) => up.onFile('licence', 'kyc', file)}
            providedLabel={td.provided}
            uploadLabel={tv.upload.cta}
          />
        </div>
      </div>

      <div
        className={cn(
          'rounded-xl border p-4',
          form.policeClearance
            ? 'border-border bg-accent-soft'
            : 'border-border',
        )}
      >
        <div className="flex items-start gap-3">
          <span
            className={cn(
              'inline-flex size-9 shrink-0 items-center justify-center rounded-md',
              form.policeClearance
                ? 'bg-success text-success-foreground'
                : 'bg-muted text-muted-foreground',
            )}
          >
            <ShieldCheck className="size-5" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold">{td.police}</span>
              <Badge variant="muted">{td.optional}</Badge>
            </div>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              {td.policeNote}
            </p>
          </div>
          <label
            className={cn(
              buttonVariants({
                size: 'sm',
                variant: form.policeClearance ? 'secondary' : 'outline',
              }),
              'shrink-0 cursor-pointer',
              up.uploading.policeClearance && 'pointer-events-none opacity-70',
            )}
          >
            <input
              type="file"
              accept={KYC_ACCEPT}
              className="sr-only"
              onChange={(e) =>
                up.onFile('policeClearance', 'kyc', e.target.files?.[0] ?? null)
              }
            />
            {up.uploading.policeClearance ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : form.policeClearance ? (
              <>
                <Check className="size-4" aria-hidden />
                {td.provided}
              </>
            ) : (
              tv.upload.cta
            )}
          </label>
        </div>
      </div>

      <p className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
        <Lock className="size-3" aria-hidden />
        {tv.sections.identity.desc}
      </p>
    </div>
  );
}

function Details({
  t,
  form,
  set,
  up,
}: Pick<UploadStepProps, 'form' | 'set' | 'up'> & {
  t: Dictionary['onboarding'];
}) {
  const td = t.details;
  const doc = t.documents;
  return (
    <div className="space-y-6">
      <StepHead title={td.title} sub={td.sub} />

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>{doc.portfolio}</Label>
          <span className="text-xs text-muted-foreground">
            {form.portfolio.length}/10
          </span>
        </div>
        <p className="text-xs text-muted-foreground">{doc.portfolioSub}</p>
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
          {form.portfolio.map((key) => (
            <div
              key={key}
              className="group relative aspect-square overflow-hidden rounded-lg border border-border bg-muted"
            >
              {up.previews[key] ? (
                // Presigned R2 URL — plain img avoids next/image config.
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={up.previews[key]}
                  alt=""
                  className="size-full object-cover"
                />
              ) : null}
              <button
                type="button"
                onClick={() => up.removePortfolio(key)}
                aria-label="Remove"
                className="absolute right-1 top-1 inline-flex size-6 items-center justify-center rounded-full bg-background/90 text-foreground shadow-sm hover:bg-background"
              >
                <X className="size-3.5" aria-hidden />
              </button>
            </div>
          ))}
          {form.portfolio.length < 10 ? (
            <label
              className={cn(
                'flex aspect-square cursor-pointer flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed border-border bg-muted text-muted-foreground transition-colors hover:bg-muted/70',
                up.uploading.portfolio && 'pointer-events-none opacity-70',
              )}
            >
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                className="sr-only"
                onChange={(e) => up.addPortfolio(e.target.files)}
              />
              {up.uploading.portfolio ? (
                <Loader2 className="size-5 animate-spin" aria-hidden />
              ) : (
                <ImagePlus className="size-5" aria-hidden />
              )}
              <span className="text-xs font-medium">{doc.addPhotos}</span>
            </label>
          ) : null}
        </div>
      </div>

      <Card>
        <CardContent className="space-y-3 p-5">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold">{td.radius}</span>
            <span className="font-mono text-sm font-semibold">
              {form.serviceRadiusKm} km
            </span>
          </div>
          <input
            type="range"
            min={2}
            max={30}
            step={1}
            value={form.serviceRadiusKm}
            onChange={(e) => set('serviceRadiusKm', Number(e.target.value))}
            className="w-full accent-primary"
          />
          <p className="text-xs text-muted-foreground">
            {td.radiusVal.replace('{n}', String(form.serviceRadiusKm))}
          </p>
        </CardContent>
      </Card>

      <div className="space-y-2">
        <Label>{td.crew}</Label>
        <div className="grid grid-cols-2 gap-3">
          {(['solo', 'team'] as const).map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => set('crewType', c)}
              className={cn(
                'flex items-center gap-3 rounded-lg border p-3.5 text-left',
                form.crewType === c
                  ? 'border-primary bg-muted'
                  : 'border-border bg-background',
              )}
            >
              <UserRound
                className={cn(
                  'size-5',
                  form.crewType === c
                    ? 'text-foreground'
                    : 'text-muted-foreground',
                )}
                aria-hidden
              />
              <span className="text-sm font-semibold">
                {c === 'solo' ? td.solo : td.team}
              </span>
            </button>
          ))}
        </div>
        {form.crewType === 'team' ? (
          <div className="space-y-1.5 pt-1">
            <Label htmlFor="o-helpers">{td.helpers}</Label>
            <Input
              id="o-helpers"
              type="number"
              min={0}
              value={form.helperCount}
              onChange={(e) => set('helperCount', e.target.value)}
            />
          </div>
        ) : null}
      </div>

      <div className="space-y-1.5">
        <Label>{td.guarantor}</Label>
        <p className="text-xs text-muted-foreground">{td.guarantorHint}</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Input
            placeholder={td.guarantorName}
            value={form.guarantorName}
            onChange={(e) => set('guarantorName', e.target.value)}
          />
          <Input
            placeholder={td.guarantorNic}
            value={form.guarantorNic}
            onChange={(e) => set('guarantorNic', e.target.value)}
          />
        </div>
      </div>
    </div>
  );
}

function Payout({ tv, form, set }: StepProps) {
  return (
    <div className="space-y-5">
      <StepHead
        title={tv.sections.payout.title}
        sub={tv.sections.payout.desc}
      />
      <div className="space-y-1.5">
        <Label htmlFor="o-holder">{tv.fields.accountHolder}</Label>
        <Input
          id="o-holder"
          value={form.payoutAccountHolder}
          onChange={(e) => set('payoutAccountHolder', e.target.value)}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="o-bank">{tv.fields.bank}</Label>
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  id="o-bank"
                  variant="outline"
                  className="w-full justify-between"
                  aria-label={tv.fields.bank}
                >
                  <span className="truncate">{form.payoutBank}</span>
                  <ChevronDown className="size-4 opacity-60" />
                </Button>
              }
            />
            <DropdownMenuContent className="min-w-56">
              <DropdownMenuRadioGroup
                value={form.payoutBank}
                onValueChange={(value) => set('payoutBank', value)}
              >
                {BANKS.map((b) => (
                  <DropdownMenuRadioItem key={b} value={b}>
                    {b}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="o-branch">{tv.fields.branch}</Label>
          <Input
            id="o-branch"
            value={form.payoutBranch}
            onChange={(e) => set('payoutBranch', e.target.value)}
          />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="o-acct" className="inline-flex items-center gap-1.5">
          {tv.fields.accountNumber}
          <Lock className="size-3 text-muted-foreground" aria-hidden />
        </Label>
        <Input
          id="o-acct"
          inputMode="numeric"
          value={form.payoutAccountNumber}
          onChange={(e) => set('payoutAccountNumber', e.target.value)}
        />
        <p className="text-xs text-muted-foreground">
          {tv.fields.accountNumberHint}
        </p>
      </div>
      <label className="flex cursor-pointer items-start gap-2.5 pt-1">
        <input
          type="checkbox"
          className="mt-0.5 size-4 accent-primary"
          checked={form.consent}
          onChange={(e) => set('consent', e.target.checked)}
        />
        <span className="text-sm leading-relaxed text-muted-foreground">
          {tv.consent}
        </span>
      </label>
    </div>
  );
}

function Submitted({
  dict,
  locale,
  police,
  approved,
}: {
  dict: Dictionary;
  locale: Locale;
  police?: boolean;
  approved?: boolean;
}) {
  const t = dict.onboarding.submitted;
  return (
    <div className="mx-auto max-w-xl text-center">
      <span
        className={cn(
          'inline-flex size-16 items-center justify-center rounded-full',
          approved
            ? 'bg-success-subtle text-success'
            : 'bg-warning-subtle text-warning-foreground',
        )}
      >
        {approved ? (
          <ShieldCheck className="size-8" aria-hidden />
        ) : (
          <Clock className="size-8" aria-hidden />
        )}
      </span>
      <h2 className="mt-5 text-2xl font-semibold tracking-tight">
        {approved ? t.tier1 : t.title}
      </h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
        {approved ? t.tier1desc : t.sub}
      </p>

      <div className="mt-8 text-left">
        <p className="mb-3 text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {t.tiers}
        </p>
        <div className="space-y-3">
          <TierRow
            active={approved}
            name={t.tier1}
            desc={t.tier1desc}
            activeLabel={t.active}
            lockedLabel={t.locked}
            badge={<VerifiedBadge size={16} />}
          />
          <TierRow
            active={!!approved && !!police}
            name={t.tier2}
            desc={t.tier2desc}
            activeLabel={t.active}
            lockedLabel={t.locked}
            badge={
              <span className="inline-flex items-center gap-1.5 rounded-full bg-primary px-2.5 py-1 text-xs font-semibold text-primary-foreground">
                <ShieldCheck className="size-3.5" aria-hidden />
                {t.tier2}
              </span>
            }
          />
        </div>
      </div>

      <div className="mt-8 flex justify-center gap-3">
        <Link
          href={`/${locale}/jobs`}
          className={buttonVariants({ size: 'lg' })}
        >
          {t.browse}
        </Link>
      </div>
    </div>
  );
}

function TierRow({
  active,
  name,
  desc,
  badge,
  activeLabel,
  lockedLabel,
}: {
  active?: boolean;
  name: string;
  desc: string;
  badge: React.ReactNode;
  activeLabel: string;
  lockedLabel: string;
}) {
  return (
    <div
      className={cn(
        'rounded-xl border p-4',
        active
          ? 'border-success bg-background'
          : 'border-dashed border-border bg-muted opacity-80',
      )}
    >
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold">{name}</span>
        {active ? (
          <Badge variant="soft">
            <CheckCircle2 className="size-3" aria-hidden />
            {activeLabel}
          </Badge>
        ) : (
          <Badge variant="muted">{lockedLabel}</Badge>
        )}
      </div>
      <p className="mt-1 mb-2.5 text-xs text-muted-foreground">{desc}</p>
      {badge}
    </div>
  );
}
