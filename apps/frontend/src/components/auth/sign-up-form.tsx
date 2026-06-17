'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button, Input } from '@repo/ui';
import { toast } from 'sonner';
import { Label } from '@/components/ui/label';
import { signUp } from '@/lib/auth-client';
import type { Locale } from '@/i18n/config';
import type { Dictionary } from '@/i18n/dictionaries';

const SignUpSchema = z
  .object({
    name: z.string().trim().min(1, 'Name is required').max(120),
    email: z.string().email(),
    password: z.string().min(8, 'Password must be at least 8 characters'),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, {
    path: ['confirm'],
    message: 'Passwords do not match',
  });
type SignUpValues = z.infer<typeof SignUpSchema>;

export function SignUpForm({
  locale,
  dict,
}: {
  locale: Locale;
  dict: Dictionary;
}) {
  const router = useRouter();
  const t = dict.auth;
  const [submitting, setSubmitting] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SignUpValues>({
    resolver: zodResolver(SignUpSchema),
    defaultValues: { name: '', email: '', password: '', confirm: '' },
  });

  async function onSubmit(values: SignUpValues) {
    setSubmitting(true);
    try {
      const result = await signUp.email({
        name: values.name,
        email: values.email,
        password: values.password,
      });
      if (result.error) {
        toast.error(result.error.message ?? t.errors.signUpFailed);
        return;
      }
      toast.success(t.signUp.success);
      // Some setups auto-sign-in after sign-up; if not, the dashboard route
      // will bounce them to /sign-in via the session guard.
      router.push(`/${locale}/dashboard`);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t.errors.signUpFailed);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="name">{t.fields.name}</Label>
        <Input
          id="name"
          autoComplete="name"
          aria-invalid={errors.name !== undefined}
          {...register('name')}
        />
        {errors.name ? (
          <p className="text-xs text-destructive">{errors.name.message}</p>
        ) : null}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="email">{t.fields.email}</Label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          aria-invalid={errors.email !== undefined}
          {...register('email')}
        />
        {errors.email ? (
          <p className="text-xs text-destructive">{errors.email.message}</p>
        ) : null}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="password">{t.fields.password}</Label>
        <Input
          id="password"
          type="password"
          autoComplete="new-password"
          aria-invalid={errors.password !== undefined}
          {...register('password')}
        />
        {errors.password ? (
          <p className="text-xs text-destructive">{errors.password.message}</p>
        ) : null}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="confirm">{t.fields.confirmPassword}</Label>
        <Input
          id="confirm"
          type="password"
          autoComplete="new-password"
          aria-invalid={errors.confirm !== undefined}
          {...register('confirm')}
        />
        {errors.confirm ? (
          <p className="text-xs text-destructive">{errors.confirm.message}</p>
        ) : null}
      </div>
      <Button type="submit" className="w-full" disabled={submitting}>
        {submitting ? t.signUp.submitting : t.signUp.submit}
      </Button>
    </form>
  );
}
