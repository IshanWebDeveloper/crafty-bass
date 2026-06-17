'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, cn, Input } from '@repo/ui';
import { toast } from 'sonner';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { createReview, listReviewsForJob } from '@/lib/api/reviews';
import { ApiError } from '@/lib/api';
import { useSession } from '@/lib/auth-client';
import type { Dictionary } from '@/i18n/dictionaries';

const LeaveReviewSchema = z.object({
  rating: z
    .string()
    .refine(
      (v) => Number.isInteger(Number(v)) && Number(v) >= 1 && Number(v) <= 5,
      {
        message: '1–5',
      },
    ),
  title: z.string().trim().max(120).optional(),
  comment: z.string().trim().max(2000).optional(),
});
type LeaveReviewValues = z.infer<typeof LeaveReviewSchema>;

export function LeaveReviewPanel({
  jobId,
  dict,
}: {
  jobId: string;
  dict: Dictionary;
}) {
  const qc = useQueryClient();
  const { data: session } = useSession();
  const t = dict.reviews;
  const [hoverRating, setHoverRating] = useState<number | null>(null);

  // Detect whether the current user has already reviewed this job.
  const { data: existing } = useQuery({
    queryKey: ['jobs', jobId, 'reviews'],
    queryFn: () => listReviewsForJob(jobId),
    enabled: !!session,
  });

  const alreadyReviewed =
    !!session && !!existing?.data.some((r) => r.reviewerId === session.user.id);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
    reset,
  } = useForm<LeaveReviewValues>({
    resolver: zodResolver(LeaveReviewSchema),
    defaultValues: { rating: '5', title: '', comment: '' },
  });

  const rating = Number(watch('rating'));

  const mutation = useMutation({
    mutationFn: (values: LeaveReviewValues) =>
      createReview(jobId, {
        rating: Number(values.rating),
        title: values.title || undefined,
        comment: values.comment || undefined,
      }),
    onSuccess: () => {
      toast.success(t.success);
      reset({ rating: '5', title: '', comment: '' });
      void qc.invalidateQueries({ queryKey: ['jobs', jobId, 'reviews'] });
    },
    onError: (err) => {
      if (err instanceof ApiError && err.status === 409) {
        toast.info(t.alreadyReviewed);
        return;
      }
      toast.error(
        err instanceof Error ? err.message : 'Failed to submit review',
      );
    },
  });

  if (alreadyReviewed) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{t.leaveTitle}</CardTitle>
        <CardDescription>{t.leaveSubtitle}</CardDescription>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={handleSubmit((v) => mutation.mutate(v))}
          className="space-y-4"
        >
          <div className="space-y-1.5">
            <Label>{t.rating}</Label>
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  className={cn(
                    'rounded-full p-1 text-2xl leading-none transition-colors',
                    (hoverRating ?? rating) >= n
                      ? 'text-yellow-500'
                      : 'text-muted-foreground',
                  )}
                  onMouseEnter={() => setHoverRating(n)}
                  onMouseLeave={() => setHoverRating(null)}
                  onClick={() => setValue('rating', String(n))}
                  aria-label={`${n} stars`}
                >
                  ★
                </button>
              ))}
            </div>
            {errors.rating ? (
              <p className="text-xs text-destructive">
                {errors.rating.message}
              </p>
            ) : null}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="review-title">{t.title}</Label>
            <Input id="review-title" {...register('title')} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="review-comment">{t.comment}</Label>
            <Textarea id="review-comment" rows={3} {...register('comment')} />
          </div>
          <Button
            type="submit"
            className="w-full"
            disabled={mutation.isPending}
          >
            {mutation.isPending ? t.submitting : t.submit}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
