'use client';

import { useState } from 'react';
import { Button, Input } from '@repo/ui';
import { toast } from 'sonner';
import { Label } from '@/components/ui/label';
import { authClient, useSession } from '@/lib/auth-client';
import { toE164LK } from '@/lib/phone';
import { OtpTimer } from '@/components/auth/otp-timer';
import type { Dictionary } from '@/i18n/dictionaries';

/**
 * New-number → OTP → verify state machine for changing the mobile number a
 * signed-in user signs in with. Verifying an OTP sent to the new number with
 * `updatePhoneNumber: true` swaps it on the current account. Shared by the
 * profile card (everyday change) and the post-recovery step (dedicated page).
 */
export function ChangePhoneNumberForm({
  dict,
  onSuccess,
  onCancel,
  submitLabel,
}: {
  dict: Dictionary;
  onSuccess?: () => void;
  onCancel?: () => void;
  /** Overrides the "Verify & update" label (e.g. "Save number" on recovery). */
  submitLabel?: string;
}) {
  const t = dict.profile.phone;
  const { data: session } = useSession();
  const current =
    (session?.user as { phoneNumber?: string })?.phoneNumber ?? '';

  const [step, setStep] = useState<'phone' | 'code'>('phone');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sentAt, setSentAt] = useState<number | null>(null);

  async function requestOtp() {
    const phoneNumber = toE164LK(phone);
    if (!phoneNumber) {
      toast.error(t.invalidNumber);
      return;
    }
    if (phoneNumber === current) {
      toast.error(t.sameNumber);
      return;
    }
    setSubmitting(true);
    try {
      const { error } = await authClient.phoneNumber.sendOtp({ phoneNumber });
      if (error) {
        toast.error(error.message ?? t.sendFailed);
        return;
      }
      setSentAt(Date.now());
      setStep('code');
    } catch {
      toast.error(t.sendFailed);
    } finally {
      setSubmitting(false);
    }
  }

  async function verify() {
    const phoneNumber = toE164LK(phone);
    if (!phoneNumber) return;
    setSubmitting(true);
    try {
      const { error } = await authClient.phoneNumber.verify({
        phoneNumber,
        code,
        updatePhoneNumber: true,
      });
      if (error) {
        toast.error(error.message ?? t.verifyFailed);
        return;
      }
      // The session cookie is JWT-cached (~5 min), so it still carries the old
      // number. Force a fresh read so consumers reflect the new number now.
      await authClient.getSession({ query: { disableCookieCache: true } });
      toast.success(t.updated);
      onSuccess?.();
    } catch {
      toast.error(t.verifyFailed);
    } finally {
      setSubmitting(false);
    }
  }

  if (step === 'code') {
    return (
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void verify();
        }}
        className="space-y-3"
      >
        <p className="text-sm text-muted-foreground">
          {t.codeSentTo.replace('{phone}', toE164LK(phone) ?? phone)}
        </p>
        <div className="space-y-1.5">
          <Label htmlFor="new-phone-code">{t.code}</Label>
          <Input
            id="new-phone-code"
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
              expiresInLabel={t.expiresIn}
              expiredLabel={t.expired}
            />
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="submit"
            size="sm"
            disabled={submitting || code.length < 6}
          >
            {submitting ? t.verifying : (submitLabel ?? t.verify)}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => void requestOtp()}
            disabled={submitting}
          >
            {t.resend}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => (onCancel ? onCancel() : setStep('phone'))}
            disabled={submitting}
          >
            {t.cancel}
          </Button>
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
      className="space-y-3"
    >
      <div className="space-y-1.5">
        <Label htmlFor="new-phone">{t.newNumber}</Label>
        <div className="flex gap-2">
          <span className="inline-flex h-8 shrink-0 items-center justify-center rounded-lg border border-input px-3 text-sm font-medium text-muted-foreground">
            +94
          </span>
          <Input
            id="new-phone"
            inputMode="tel"
            autoComplete="tel"
            placeholder="077 123 4567"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Button type="submit" size="sm" disabled={submitting}>
          {submitting ? t.sending : t.sendCode}
        </Button>
        {onCancel ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onCancel}
            disabled={submitting}
          >
            {t.cancel}
          </Button>
        ) : null}
      </div>
    </form>
  );
}
