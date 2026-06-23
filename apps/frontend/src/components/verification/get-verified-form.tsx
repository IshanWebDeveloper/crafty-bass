'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Badge, Button, Input, cn, tagVariants } from '@repo/ui';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Lock, ShieldAlert, Upload as UploadIcon } from 'lucide-react';
import { toast } from 'sonner';
import { listCategories } from '@/lib/api/categories';
import { listSkills } from '@/lib/api/profiles';
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

type VerificationDict = Dictionary['verification'];

function FieldRow({
  label,
  hint,
  sensitive,
  htmlFor,
  children,
}: {
  label: string;
  hint?: string;
  sensitive?: boolean;
  htmlFor?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor} className="inline-flex items-center gap-1.5">
        {label}
        {sensitive ? (
          <Lock className="size-3 text-muted-foreground" aria-hidden />
        ) : null}
      </Label>
      {children}
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function Upload({
  label,
  hint,
  sensitive,
  t,
}: {
  label: string;
  hint?: string;
  sensitive?: boolean;
  t: VerificationDict;
}) {
  return (
    <FieldRow label={label} hint={hint} sensitive={sensitive}>
      <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-dashed border-border bg-muted px-4 py-3.5 text-muted-foreground transition-colors hover:bg-muted/70">
        <UploadIcon className="size-[18px]" aria-hidden />
        <span className="flex flex-col">
          <span className="text-sm font-medium text-foreground">
            {t.upload.cta}
          </span>
          <span className="text-xs">{t.upload.hint}</span>
        </span>
        <input
          type="file"
          accept="image/*,application/pdf"
          className="sr-only"
        />
      </label>
    </FieldRow>
  );
}

function Section({
  step,
  title,
  desc,
  children,
}: {
  step: number;
  title: string;
  desc?: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-start gap-3">
          <span className="inline-flex size-6.5 shrink-0 items-center justify-center rounded-full bg-primary font-mono text-sm font-semibold text-primary-foreground">
            {step}
          </span>
          <div className="flex flex-col gap-1">
            <CardTitle className="text-lg">{title}</CardTitle>
            {desc ? <CardDescription>{desc}</CardDescription> : null}
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 pt-2">{children}</CardContent>
    </Card>
  );
}

export function GetVerifiedForm({ dict }: { dict: Dictionary }) {
  const t = dict.verification;
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [selectedSkillIds, setSelectedSkillIds] = useState<Set<string>>(
    () => new Set(),
  );

  const { data: categories } = useQuery({
    queryKey: ['categories'],
    queryFn: listCategories,
    staleTime: 5 * 60_000,
  });
  const { data: skills } = useQuery({
    queryKey: ['skills'],
    queryFn: () => listSkills(),
    staleTime: 5 * 60_000,
  });

  function toggleSkill(id: string) {
    setSelectedSkillIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    // TODO(backend): POST verification submission (NIC/photo/licence uploads +
    // payout details) to a tradesman-verification endpoint, then reflect the
    // returned status. No such endpoint exists yet (see plan Gap #4).
    setTimeout(() => {
      setSubmitting(false);
      setSubmitted(true);
      toast.success(t.submitted);
    }, 400);
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-6">
      {submitted ? (
        <div className="flex items-center gap-3.5 rounded-lg bg-warning-subtle px-4 py-3.5 text-warning-foreground">
          <ShieldAlert className="size-5 shrink-0" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">{t.status.heading}</p>
            <p className="mt-0.5 text-xs">{t.status.body}</p>
          </div>
          <Badge variant="info" className="shrink-0">
            {t.status.underReview}
          </Badge>
        </div>
      ) : null}

      <Section
        step={1}
        title={t.sections.identity.title}
        desc={t.sections.identity.desc}
      >
        <FieldRow label={t.fields.fullName} htmlFor="v-name">
          <Input id="v-name" autoComplete="name" />
        </FieldRow>
        <div className="grid gap-4 sm:grid-cols-2">
          <FieldRow label={t.fields.gender} htmlFor="v-gender">
            <NativeSelect id="v-gender">
              <option>{t.genders.male}</option>
              <option>{t.genders.female}</option>
              <option>{t.genders.other}</option>
              <option>{t.genders.preferNot}</option>
            </NativeSelect>
          </FieldRow>
          <FieldRow label={t.fields.dob} htmlFor="v-dob">
            <Input id="v-dob" type="date" />
          </FieldRow>
        </div>
        <FieldRow label={t.fields.nic} hint={t.fields.nicHint} htmlFor="v-nic">
          <Input id="v-nic" />
        </FieldRow>
        <div className="grid gap-4 sm:grid-cols-2">
          <Upload label={t.fields.nicFront} sensitive t={t} />
          <Upload label={t.fields.nicBack} sensitive t={t} />
        </div>
        <Upload
          label={t.fields.photo}
          hint={t.fields.photoHint}
          sensitive
          t={t}
        />
      </Section>

      <Section
        step={2}
        title={t.sections.address.title}
        desc={t.sections.address.desc}
      >
        <FieldRow label={t.fields.address} htmlFor="v-address">
          <Textarea id="v-address" rows={2} />
        </FieldRow>
        <div className="grid gap-4 sm:grid-cols-2">
          <FieldRow label={t.fields.city} htmlFor="v-city">
            <Input id="v-city" />
          </FieldRow>
          <FieldRow label={t.fields.district} htmlFor="v-district">
            <NativeSelect id="v-district">
              {DISTRICTS.map((d) => (
                <option key={d}>{d}</option>
              ))}
            </NativeSelect>
          </FieldRow>
        </div>
      </Section>

      <Section
        step={3}
        title={t.sections.trade.title}
        desc={t.sections.trade.desc}
      >
        <FieldRow label={t.fields.primaryTrade} htmlFor="v-trade">
          <NativeSelect id="v-trade">
            {categories?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nameEn}
              </option>
            ))}
          </NativeSelect>
        </FieldRow>
        <FieldRow label={t.fields.yearsExperience} htmlFor="v-years">
          <Input id="v-years" type="number" min={0} />
        </FieldRow>
        <div className="space-y-2">
          <Label>{t.fields.skills}</Label>
          <div className="flex flex-wrap gap-2 rounded-lg border border-border p-3">
            {skills?.map((skill) => {
              const checked = selectedSkillIds.has(skill.id);
              return (
                <button
                  key={skill.id}
                  type="button"
                  aria-pressed={checked}
                  onClick={() => toggleSkill(skill.id)}
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
        <div className="grid gap-4 sm:grid-cols-2">
          <Upload label={t.fields.licence} hint={t.fields.licenceHint} t={t} />
          <Upload label={t.fields.additionalCert} t={t} />
        </div>
        <FieldRow label={t.fields.licenceNumber} htmlFor="v-licence-no">
          <Input
            id="v-licence-no"
            placeholder={t.fields.licenceNumberPlaceholder}
          />
        </FieldRow>
      </Section>

      <Section
        step={4}
        title={t.sections.payout.title}
        desc={t.sections.payout.desc}
      >
        <FieldRow label={t.fields.accountHolder} htmlFor="v-holder">
          <Input id="v-holder" />
        </FieldRow>
        <div className="grid gap-4 sm:grid-cols-2">
          <FieldRow label={t.fields.bank} htmlFor="v-bank">
            <NativeSelect id="v-bank">
              {BANKS.map((b) => (
                <option key={b}>{b}</option>
              ))}
            </NativeSelect>
          </FieldRow>
          <FieldRow label={t.fields.branch} htmlFor="v-branch">
            <Input id="v-branch" />
          </FieldRow>
        </div>
        <FieldRow
          label={t.fields.accountNumber}
          hint={t.fields.accountNumberHint}
          sensitive
          htmlFor="v-account"
        >
          <Input id="v-account" inputMode="numeric" />
        </FieldRow>
      </Section>

      <Section
        step={5}
        title={t.sections.confirm.title}
        desc={t.sections.confirm.desc}
      >
        <label className="flex cursor-pointer items-start gap-2.5">
          <input
            type="checkbox"
            required
            className="mt-0.5 size-4 shrink-0 accent-[var(--primary)]"
          />
          <span className="text-sm leading-relaxed text-muted-foreground">
            {t.consent}
          </span>
        </label>
        <Button type="submit" className="w-full" disabled={submitting}>
          {submitting ? t.submitting : t.submit}
        </Button>
      </Section>
    </form>
  );
}
