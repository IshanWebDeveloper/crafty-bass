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
  Lock,
  ShieldCheck,
  UserRound,
} from 'lucide-react';
import { Badge, Button, Input, buttonVariants, cn } from '@repo/ui';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/select';
import { VerifiedBadge } from '@repo/ui';
import {
  getMyVerification,
  submitVerification,
  type SubmitVerificationBody,
} from '@/lib/api/verification';
import type { Locale } from '@/i18n/config';
import type { Dictionary } from '@/i18n/dictionaries';

const DISTRICTS = [
  'Colombo',
  'Gampaha',
  'Kalutara',
  'Kandy',
  'Galle',
  'Matara',
  'Kurunegala',
  'Jaffna',
];
const BANKS = [
  'Bank of Ceylon',
  "People's Bank",
  'Commercial Bank',
  'Sampath Bank',
  'Hatton National Bank',
  'Nations Trust Bank',
];

const PLACEHOLDER_KEY = 'uploaded'; // stand-in reference (real upload deferred)

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
  // documents (provided flags)
  nicFront: boolean;
  nicBack: boolean;
  photo: boolean;
  gramaNiladhari: boolean;
  licence: boolean;
  licenceNumber: string;
  policeClearance: boolean;
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

const EMPTY: Form = {
  fullName: '',
  gender: '',
  dateOfBirth: '',
  nicNumber: '',
  addressLine: '',
  city: '',
  district: DISTRICTS[0],
  primaryTrade: '',
  yearsExperience: '',
  nicFront: false,
  nicBack: false,
  photo: false,
  gramaNiladhari: false,
  licence: false,
  licenceNumber: '',
  policeClearance: false,
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

  const set = <K extends keyof Form>(key: K, value: Form[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const mutation = useMutation({
    mutationFn: () => {
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
        nicFrontKey: form.nicFront ? PLACEHOLDER_KEY : undefined,
        nicBackKey: form.nicBack ? PLACEHOLDER_KEY : undefined,
        photoKey: form.photo ? PLACEHOLDER_KEY : undefined,
        gramaNiladhariKey: form.gramaNiladhari ? PLACEHOLDER_KEY : undefined,
        licenceKey: form.licence ? PLACEHOLDER_KEY : undefined,
        licenceNumber: form.licenceNumber || undefined,
        policeClearanceKey: form.policeClearance ? PLACEHOLDER_KEY : undefined,
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
      return submitVerification(body);
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
      <Submitted dict={dict} locale={locale} police={form.policeClearance} />
    );
  }

  const canContinue =
    step === 0 ? form.fullName.trim() && form.nicNumber.trim() : true;
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
        <Profile t={t} tv={tv} form={form} set={set} />
      ) : step === 1 ? (
        <Documents t={t} tv={tv} form={form} set={set} />
      ) : step === 2 ? (
        <Details t={t} form={form} set={set} />
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
          {t.stepOf
            .replace('{current}', String(step + 1))
            .replace('{total}', String(STAGES.length))}
        </span>
        {isLast ? (
          <Button
            onClick={() => mutation.mutate()}
            disabled={!form.consent || mutation.isPending}
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

function Profile({ t, tv, form, set }: StepProps) {
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
          <Input
            id="o-dob"
            type="date"
            value={form.dateOfBirth}
            onChange={(e) => set('dateOfBirth', e.target.value)}
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
          <NativeSelect
            id="o-district"
            value={form.district}
            onChange={(e) => set('district', e.target.value)}
          >
            {DISTRICTS.map((d) => (
              <option key={d}>{d}</option>
            ))}
          </NativeSelect>
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
    </div>
  );
}

function DocTile({
  icon: Icon,
  name,
  provided,
  sensitive,
  onToggle,
  providedLabel,
  uploadLabel,
}: {
  icon: typeof CreditCard;
  name: string;
  provided: boolean;
  sensitive?: boolean;
  onToggle: () => void;
  providedLabel: string;
  uploadLabel: string;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={provided}
      className={cn(
        'flex w-full items-center gap-3.5 rounded-lg border p-3.5 text-left transition-colors',
        provided
          ? 'border-success bg-accent-soft'
          : 'border-dashed border-border bg-muted hover:bg-muted/70',
      )}
    >
      <span
        className={cn(
          'inline-flex size-10 shrink-0 items-center justify-center rounded-md',
          provided
            ? 'bg-success text-success-foreground'
            : 'border border-border bg-background text-muted-foreground',
        )}
      >
        {provided ? (
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
        <span className="mt-0.5 block text-xs text-muted-foreground">
          {provided ? providedLabel : uploadLabel}
        </span>
      </span>
    </button>
  );
}

function Documents({ t, tv, form, set }: StepProps) {
  const td = t.documents;
  return (
    <div className="space-y-5">
      <StepHead title={td.title} sub={td.sub} />
      <div className="grid gap-3 sm:grid-cols-2">
        <DocTile
          icon={CreditCard}
          name={tv.fields.nicFront}
          provided={form.nicFront}
          sensitive
          onToggle={() => set('nicFront', !form.nicFront)}
          providedLabel={td.provided}
          uploadLabel={tv.upload.cta}
        />
        <DocTile
          icon={CreditCard}
          name={tv.fields.nicBack}
          provided={form.nicBack}
          sensitive
          onToggle={() => set('nicBack', !form.nicBack)}
          providedLabel={td.provided}
          uploadLabel={tv.upload.cta}
        />
        <DocTile
          icon={UserRound}
          name={tv.fields.photo}
          provided={form.photo}
          sensitive
          onToggle={() => set('photo', !form.photo)}
          providedLabel={td.provided}
          uploadLabel={tv.upload.cta}
        />
        <DocTile
          icon={FileBadge}
          name={td.gramaNiladhari}
          provided={form.gramaNiladhari}
          sensitive
          onToggle={() => set('gramaNiladhari', !form.gramaNiladhari)}
          providedLabel={td.provided}
          uploadLabel={tv.upload.cta}
        />
        <div className="sm:col-span-2">
          <DocTile
            icon={Award}
            name={tv.fields.licence}
            provided={form.licence}
            onToggle={() => set('licence', !form.licence)}
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
          <Button
            size="sm"
            variant={form.policeClearance ? 'secondary' : 'outline'}
            onClick={() => set('policeClearance', !form.policeClearance)}
            className="shrink-0"
          >
            {form.policeClearance ? (
              <>
                <Check className="size-4" aria-hidden />
                {td.provided}
              </>
            ) : (
              tv.upload.cta
            )}
          </Button>
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
}: Pick<StepProps, 'form' | 'set'> & { t: Dictionary['onboarding'] }) {
  const td = t.details;
  return (
    <div className="space-y-6">
      <StepHead title={td.title} sub={td.sub} />

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
          <NativeSelect
            id="o-bank"
            value={form.payoutBank}
            onChange={(e) => set('payoutBank', e.target.value)}
          >
            {BANKS.map((b) => (
              <option key={b}>{b}</option>
            ))}
          </NativeSelect>
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
