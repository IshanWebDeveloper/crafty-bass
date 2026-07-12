'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Building2, Check, Wrench } from 'lucide-react';
import { Button, Input, cn } from '@repo/ui';
import { toast } from 'sonner';
import { Label } from '@/components/ui/label';
import { authClient } from '@/lib/auth-client';
import { useSessionStore } from '@/lib/stores/session-store';
import { toE164LK } from '@/lib/phone';
import type { Locale } from '@/i18n/config';
import type { Dictionary } from '@/i18n/dictionaries';

type Role = 'homeowner' | 'tradesman';

export function SignUpForm({
  locale,
  dict,
}: {
  locale: Locale;
  dict: Dictionary;
}) {
  const router = useRouter();
  const t = dict.auth;
  const tp = t.phone;
  const [step, setStep] = useState<'form' | 'code'>('form');
  const [role, setRole] = useState<Role>('tradesman');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [code, setCode] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function requestOtp() {
    const phoneNumber = toE164LK(phone);
    if (!name.trim()) {
      toast.error(t.signUp.nameRequired);
      return;
    }
    if (!phoneNumber) {
      toast.error(tp.invalidNumber);
      return;
    }
    if (!agreed) {
      toast.error(t.signUp.consentRequired);
      return;
    }
    setSubmitting(true);
    try {
      const { error } = await authClient.phoneNumber.sendOtp({ phoneNumber });
      if (error) {
        toast.error(error.message ?? tp.sendFailed);
        return;
      }
      setStep('code');
    } catch {
      toast.error(tp.sendFailed);
    } finally {
      setSubmitting(false);
    }
  }

  async function verify(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const phoneNumber = toE164LK(phone);
    if (!phoneNumber) return;
    setSubmitting(true);
    try {
      const { error } = await authClient.phoneNumber.verify({
        phoneNumber,
        code,
      });
      if (error) {
        toast.error(error.message ?? tp.verifyFailed);
        return;
      }
      // The OTP verify created the account with a temporary email/name. Patch
      // the real name now; set the recovery email best-effort (it'll be sent a
      // verification link).
      const userType = role === 'tradesman' ? 'TRADESMAN' : 'HOMEOWNER';
      // Persist the role the user picked. `userType` is a better-auth custom
      // field (packages/auth), so this writes it into the session - which is
      // what the server-side role guards (lib/server-session.ts) read. Without
      // this the choice was discarded and userType stayed null.
      await authClient
        .updateUser({ name: name.trim(), userType })
        .catch(() => {});
      if (email.trim()) {
        await authClient
          .changeEmail({ newEmail: email.trim() })
          .catch(() => {});
      }
      // Optimistically prime the client store so the role-aware header/nav is
      // correct the instant we redirect, before the `me` query refetches.
      useSessionStore.getState().setUserType(userType);
      toast.success(t.signUp.success);
      router.push(
        role === 'tradesman'
          ? `/${locale}/account/get-verified`
          : `/${locale}/dashboard`,
      );
      router.refresh();
    } catch {
      toast.error(tp.verifyFailed);
    } finally {
      setSubmitting(false);
    }
  }

  if (step === 'code') {
    return (
      <form onSubmit={verify} className="space-y-4">
        <p className="text-sm text-muted-foreground">
          {tp.codeSentTo.replace('{phone}', toE164LK(phone) ?? phone)}
        </p>
        <div className="space-y-1.5">
          <Label htmlFor="code">{tp.code}</Label>
          <Input
            id="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            placeholder="••••••"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
          />
        </div>
        <Button
          type="submit"
          className="w-full"
          disabled={submitting || code.length < 6}
        >
          {submitting ? tp.verifying : tp.verifyCreate}
        </Button>
        <div className="flex items-center justify-between text-sm">
          <button
            type="button"
            onClick={() => setStep('form')}
            className="text-muted-foreground underline-offset-4 hover:underline"
          >
            {tp.changeNumber}
          </button>
          <button
            type="button"
            onClick={() => void requestOtp()}
            disabled={submitting}
            className="text-muted-foreground underline-offset-4 hover:underline"
          >
            {tp.resend}
          </button>
        </div>
      </form>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void requestOtp();
      }}
      className="space-y-4"
    >
      <div className="space-y-1.5">
        <Label>{t.signUp.iWantTo}</Label>
        <div
          role="radiogroup"
          aria-label={t.signUp.iWantTo}
          className="grid grid-cols-2 gap-3"
        >
          <RoleTile
            icon={<Building2 className="size-5" />}
            title={t.signUp.roleHomeowner}
            sub={t.signUp.roleHomeownerSub}
            selected={role === 'homeowner'}
            onSelect={() => setRole('homeowner')}
          />
          <RoleTile
            icon={<Wrench className="size-5" />}
            title={t.signUp.roleTradesman}
            sub={t.signUp.roleTradesmanSub}
            selected={role === 'tradesman'}
            onSelect={() => setRole('tradesman')}
          />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="name">{t.fields.name}</Label>
        <Input
          id="name"
          autoComplete="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="phone">{tp.number}</Label>
        <div className="flex gap-2">
          <span className="inline-flex h-8 shrink-0 items-center justify-center rounded-lg border border-input px-3 text-sm font-medium text-muted-foreground">
            +94
          </span>
          <Input
            id="phone"
            inputMode="tel"
            autoComplete="tel"
            placeholder="077 123 4567"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
        </div>
        <p className="text-xs text-muted-foreground">{t.fields.phoneHint}</p>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="email">{t.fields.recoveryEmail}</Label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <p className="text-xs text-muted-foreground">
          {t.fields.recoveryEmailHint}
        </p>
      </div>
      <label
        htmlFor="consent"
        className="flex cursor-pointer items-start gap-2.5"
      >
        <input
          id="consent"
          type="checkbox"
          checked={agreed}
          onChange={(e) => setAgreed(e.target.checked)}
          className="mt-0.5 size-4 shrink-0 accent-[var(--primary)]"
        />
        <span className="text-xs leading-relaxed text-muted-foreground">
          {t.signUp.consentPre}{' '}
          <Link
            href={`/${locale}/terms`}
            className="font-medium text-foreground underline underline-offset-2"
          >
            {t.signUp.terms}
          </Link>{' '}
          {t.signUp.consentAnd}{' '}
          <Link
            href={`/${locale}/privacy-policy`}
            className="font-medium text-foreground underline underline-offset-2"
          >
            {t.signUp.privacy}
          </Link>
          .
        </span>
      </label>
      <p className="text-[0.7rem] leading-relaxed text-muted-foreground">
        {t.signUp.contactConsent}
      </p>
      <Button type="submit" className="w-full" disabled={submitting || !agreed}>
        {submitting ? tp.sending : tp.send}
      </Button>
    </form>
  );
}

function RoleTile({
  icon,
  title,
  sub,
  selected,
  onSelect,
}: {
  icon: React.ReactNode;
  title: string;
  sub: string;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={cn(
        'flex flex-col gap-2 rounded-xl border p-4 text-left transition-colors',
        selected
          ? 'border-primary bg-accent-soft shadow-soft'
          : 'border-border bg-background hover:bg-muted',
      )}
    >
      <div className="flex items-center justify-between">
        {icon}
        <span
          className={cn(
            'inline-flex size-[18px] items-center justify-center rounded-full border',
            selected
              ? 'border-primary bg-primary text-primary-foreground'
              : 'border-border',
          )}
        >
          {selected ? <Check className="size-3" /> : null}
        </span>
      </div>
      <div>
        <span className="block text-sm font-semibold">{title}</span>
        <span className="mt-0.5 block text-xs leading-snug text-muted-foreground">
          {sub}
        </span>
      </div>
    </button>
  );
}
