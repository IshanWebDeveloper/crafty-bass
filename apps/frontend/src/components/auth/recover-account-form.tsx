'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button, Input } from '@repo/ui';
import { toast } from 'sonner';
import { Label } from '@/components/ui/label';
import { authClient } from '@/lib/auth-client';
import { OtpTimer } from './otp-timer';
import type { Locale } from '@/i18n/config';
import type { Dictionary } from '@/i18n/dictionaries';

// Permissive client-side email check — the real validation is the server only
// emitting a code for an address that actually has an account.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function RecoverAccountForm({
  locale,
  dict,
}: {
  locale: Locale;
  dict: Dictionary;
}) {
  const router = useRouter();
  const tr = dict.auth.recovery;
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sentAt, setSentAt] = useState<number | null>(null);

  async function requestCode() {
    const trimmed = email.trim();
    if (!EMAIL_RE.test(trimmed)) {
      toast.error(tr.invalidEmail);
      return;
    }
    setSubmitting(true);
    try {
      const { error } = await authClient.emailOtp.sendVerificationOtp({
        email: trimmed,
        type: 'sign-in',
      });
      if (error) {
        toast.error(error.message ?? tr.sendFailed);
        return;
      }
      // Don't reveal whether the address has an account — always advance and
      // show the neutral hint.
      toast.message(tr.noAccountHint);
      setSentAt(Date.now());
      setStep('code');
    } catch {
      toast.error(tr.sendFailed);
    } finally {
      setSubmitting(false);
    }
  }

  async function verify(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const { error } = await authClient.signIn.emailOtp({
        email: email.trim(),
        otp: code,
      });
      if (error) {
        toast.error(error.message ?? tr.verifyFailed);
        return;
      }
      toast.success(tr.success);
      // Hand off to the dedicated "set a new number" step — the whole point of
      // recovering when the old number is gone.
      router.push(`/${locale}/account/phone?recovered=1`);
      router.refresh();
    } catch {
      toast.error(tr.verifyFailed);
    } finally {
      setSubmitting(false);
    }
  }

  if (step === 'code') {
    return (
      <form onSubmit={verify} className="space-y-4">
        <p className="text-sm text-muted-foreground">
          {tr.codeSentTo.replace('{email}', email.trim())}
        </p>
        <div className="space-y-1.5">
          <Label htmlFor="recovery-code">{tr.code}</Label>
          <Input
            id="recovery-code"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            placeholder="••••••"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
          />
          {sentAt ? (
            <OtpTimer
              sentAt={sentAt}
              expiresInLabel={tr.expiresIn}
              expiredLabel={tr.expired}
            />
          ) : null}
        </div>
        <Button
          type="submit"
          className="w-full"
          disabled={submitting || code.length < 6}
        >
          {submitting ? tr.verifying : tr.verify}
        </Button>
        <div className="flex items-center justify-between text-sm">
          <button
            type="button"
            onClick={() => setStep('email')}
            className="text-muted-foreground underline-offset-4 hover:underline"
          >
            {tr.changeEmail}
          </button>
          <button
            type="button"
            onClick={() => void requestCode()}
            disabled={submitting}
            className="text-muted-foreground underline-offset-4 hover:underline"
          >
            {tr.resend}
          </button>
        </div>
      </form>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void requestCode();
      }}
      className="space-y-4"
    >
      <div className="space-y-1.5">
        <Label htmlFor="recovery-email">{tr.email}</Label>
        <Input
          id="recovery-email"
          type="email"
          autoComplete="email"
          placeholder={tr.emailPlaceholder}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>
      <Button type="submit" className="w-full" disabled={submitting}>
        {submitting ? tr.sending : tr.send}
      </Button>
      <p className="text-center text-sm">
        <Link
          href={`/${locale}/sign-in`}
          className="text-muted-foreground underline-offset-4 hover:underline"
        >
          {tr.backToSignIn}
        </Link>
      </p>
    </form>
  );
}
