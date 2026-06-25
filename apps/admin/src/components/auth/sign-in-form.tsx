'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button, Input } from '@repo/ui';
import { authClient } from '@/lib/auth-client';
import { toE164LK } from '@/lib/phone';

// Phone-OTP sign-in for the admin console. Same credential flow as the public
// app (packages/auth/src/index.ts), but role enforcement happens after sign-in
// in AuthGuard — a non-admin who authenticates here is shown an access-denied
// screen rather than the dashboard. In dev the OTP is printed to the backend
// console (or use the static DEV_PHONE_OTP, default 123456).
export function SignInForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [step, setStep] = useState<'phone' | 'code'>('phone');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function requestOtp() {
    const phoneNumber = toE164LK(phone);
    if (!phoneNumber) {
      setError('Enter a valid Sri Lankan mobile number.');
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const { error: otpError } = await authClient.phoneNumber.sendOtp({
        phoneNumber,
      });
      if (otpError) {
        setError(otpError.message ?? 'Could not send the code. Try again.');
        return;
      }
      setStep('code');
    } catch {
      setError('Could not send the code. Try again.');
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
    setError(null);
    setSubmitting(true);
    try {
      const { error: verifyError } = await authClient.phoneNumber.verify({
        phoneNumber,
        code,
      });
      if (verifyError) {
        setError(verifyError.message ?? 'That code is invalid or expired.');
        return;
      }
      // Bounce back to wherever the guard sent us from, defaulting to the root
      // dashboard. router.refresh() lets the guard re-read the new session.
      router.replace(params.get('from') ?? '/');
      router.refresh();
    } catch {
      setError('That code is invalid or expired.');
    } finally {
      setSubmitting(false);
    }
  }

  if (step === 'code') {
    const phoneNumber = toE164LK(phone) ?? phone;
    return (
      <form onSubmit={verify} className="space-y-4">
        <p className="text-sm text-muted-foreground">
          We sent a 6-digit code to {phoneNumber}.
        </p>
        <div className="space-y-1.5">
          <label htmlFor="code" className="text-sm font-medium">
            Verification code
          </label>
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
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <Button
          type="submit"
          className="w-full"
          disabled={submitting || code.length < 6}
        >
          {submitting ? 'Verifying…' : 'Verify & sign in'}
        </Button>
        <div className="flex items-center justify-between text-sm">
          <button
            type="button"
            onClick={() => {
              setError(null);
              setStep('phone');
            }}
            className="text-muted-foreground underline-offset-4 hover:underline"
          >
            Change number
          </button>
          <button
            type="button"
            onClick={() => void requestOtp()}
            disabled={submitting}
            className="text-muted-foreground underline-offset-4 hover:underline"
          >
            Resend code
          </button>
        </div>
      </form>
    );
  }

  return (
    <form onSubmit={sendCode} className="space-y-4">
      <div className="space-y-1.5">
        <label htmlFor="phone" className="text-sm font-medium">
          Mobile number
        </label>
        <div className="flex gap-2">
          <span className="inline-flex h-9 shrink-0 items-center justify-center rounded-md border border-input px-3 text-sm font-medium text-muted-foreground">
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
        <p className="text-xs text-muted-foreground">
          Admin and support accounts only.
        </p>
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <Button type="submit" className="w-full" disabled={submitting}>
        {submitting ? 'Sending…' : 'Send code'}
      </Button>
    </form>
  );
}
