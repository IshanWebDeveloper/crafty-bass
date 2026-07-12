'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button, Input } from '@repo/ui';
import { toast } from 'sonner';
import { Label } from '@/components/ui/label';
import { authClient } from '@/lib/auth-client';
import { toE164LK } from '@/lib/phone';
import type { Locale } from '@/i18n/config';
import type { Dictionary } from '@/i18n/dictionaries';

export function SignInForm({
  locale,
  dict,
}: {
  locale: Locale;
  dict: Dictionary;
}) {
  const router = useRouter();
  const t = dict.auth;
  const tp = t.phone;
  const [step, setStep] = useState<'phone' | 'code'>('phone');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function requestOtp() {
    const phoneNumber = toE164LK(phone);
    if (!phoneNumber) {
      toast.error(tp.invalidNumber);
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

  function sendCode(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    void requestOtp();
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
      toast.success(t.signIn.success);
      router.push(`/${locale}/dashboard`);
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
          {submitting ? tp.verifying : tp.verifySignIn}
        </Button>
        <div className="flex items-center justify-between text-sm">
          <button
            type="button"
            onClick={() => setStep('phone')}
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
    <form onSubmit={sendCode} className="space-y-4">
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
        <p className="text-xs text-muted-foreground">{tp.numberHint}</p>
      </div>
      <Button type="submit" className="w-full" disabled={submitting}>
        {submitting ? tp.sending : tp.send}
      </Button>
      <p className="text-center text-sm">
        <Link
          href={`/${locale}/account-recovery`}
          className="text-muted-foreground underline-offset-4 hover:underline"
        >
          {t.signIn.lostPhone}
        </Link>
      </p>
    </form>
  );
}
