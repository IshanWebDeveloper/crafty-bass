'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { type ColumnDef } from '@tanstack/react-table';
import {
  Badge,
  Button,
  RatingStars,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@repo/ui';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@repo/ui/components/ui/sheet';
import { ApiError } from '@/lib/api';
import { adminKeys } from '@/lib/query-keys';
import { DataTable } from '@/components/data-table';
import {
  listReviews,
  moderateReview,
  deleteReview,
  type AdminReview,
  type ListReviewsParams,
} from '@/lib/api/reviews';

const PAGE_SIZE = 20;

const RATING_FILTERS = [
  { value: 'all', label: 'All ratings' },
  { value: '1', label: '1 star' },
  { value: '2', label: '2 stars' },
  { value: '3', label: '3 stars' },
  { value: '4', label: '4 stars' },
  { value: '5', label: '5 stars' },
];

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function ReviewsManager() {
  const [rating, setRating] = useState('all');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<AdminReview | null>(null);

  const params: ListReviewsParams = useMemo(
    () => ({
      page,
      limit: PAGE_SIZE,
      ...(rating !== 'all' ? { rating: Number(rating) } : {}),
    }),
    [page, rating],
  );

  const { data, isPending, isError, error } = useQuery({
    queryKey: adminKeys.reviewsList(params),
    queryFn: () => listReviews(params),
  });

  const columns = useMemo<ColumnDef<AdminReview, unknown>[]>(
    () => [
      {
        header: 'Rating',
        cell: ({ row }) => (
          <RatingStars value={row.original.rating} showValue={false} />
        ),
      },
      {
        header: 'Review',
        cell: ({ row }) => (
          <div className="max-w-xs">
            {row.original.title ? (
              <span className="block font-medium">{row.original.title}</span>
            ) : null}
            <span className="line-clamp-1 text-muted-foreground">
              {row.original.comment ?? '—'}
            </span>
          </div>
        ),
      },
      {
        header: 'Reviewer → Reviewee',
        cell: ({ row }) => (
          <span className="whitespace-nowrap text-muted-foreground">
            {row.original.reviewer?.name ?? '—'} →{' '}
            {row.original.reviewee?.name ?? '—'}
          </span>
        ),
      },
      {
        header: 'Visibility',
        cell: ({ row }) =>
          row.original.isPublic ? (
            <Badge variant="success">Public</Badge>
          ) : (
            <Badge variant="muted">Hidden</Badge>
          ),
      },
      {
        header: 'Created',
        cell: ({ row }) => (
          <span className="whitespace-nowrap text-muted-foreground">
            {formatDate(row.original.createdAt)}
          </span>
        ),
      },
    ],
    [],
  );

  return (
    <div className="space-y-4">
      <Select
        items={RATING_FILTERS}
        value={rating}
        onValueChange={(value) => {
          setRating(value as string);
          setPage(1);
        }}
      >
        <SelectTrigger className="w-48" aria-label="Filter by rating">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {RATING_FILTERS.map((item) => (
            <SelectItem key={item.value} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <DataTable
        columns={columns}
        data={data?.data ?? []}
        pageIndex={page - 1}
        pageCount={data?.meta.lastPage ?? 0}
        total={data?.meta.total ?? 0}
        onPageChange={(i) => setPage(i + 1)}
        isLoading={isPending}
        isError={isError}
        errorMessage={error instanceof Error ? error.message : undefined}
        emptyMessage="No reviews match this filter."
        onRowClick={(r) => setSelected(r)}
      />

      <ReviewSheet
        review={selected}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
      />
    </div>
  );
}

function ReviewSheet({
  review,
  onOpenChange,
}: {
  review: AdminReview | null;
  onOpenChange: (open: boolean) => void;
}) {
  const qc = useQueryClient();
  const [formError, setFormError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: adminKeys.reviews() });
  };

  const onError = (fallback: string) => (err: unknown) =>
    setFormError(
      err instanceof ApiError
        ? err.message
        : err instanceof Error
          ? err.message
          : fallback,
    );

  const toggleVisibility = useMutation({
    mutationFn: () =>
      moderateReview(review!.id, { isPublic: !review!.isPublic }),
    onSuccess: () => {
      invalidate();
      onOpenChange(false);
    },
    onError: onError('Failed to update review'),
  });

  const remove = useMutation({
    mutationFn: () => deleteReview(review!.id),
    onSuccess: () => {
      invalidate();
      onOpenChange(false);
    },
    onError: onError('Failed to delete review'),
  });

  return (
    <Sheet
      open={!!review}
      onOpenChange={(open) => {
        if (!open) {
          setConfirmDelete(false);
          setFormError(null);
        }
        onOpenChange(open);
      }}
    >
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        {review ? (
          <>
            <SheetHeader>
              <SheetTitle>Review detail</SheetTitle>
              <SheetDescription>
                On job “{review.job?.title ?? '—'}” ·{' '}
                {formatDate(review.createdAt)}
              </SheetDescription>
            </SheetHeader>

            <div className="flex flex-col gap-5 px-4 pb-4">
              <div className="flex items-center gap-3">
                <RatingStars value={review.rating} />
                {review.isPublic ? (
                  <Badge variant="success">Public</Badge>
                ) : (
                  <Badge variant="muted">Hidden</Badge>
                )}
              </div>

              {review.title ? (
                <p className="font-medium">{review.title}</p>
              ) : null}
              <p className="rounded-md bg-muted/40 p-3 text-sm whitespace-pre-wrap">
                {review.comment ?? 'No written comment.'}
              </p>

              <dl className="grid grid-cols-2 gap-3 text-sm">
                <div className="space-y-0.5">
                  <dt className="text-xs text-muted-foreground">Reviewer</dt>
                  <dd className="font-medium">
                    {review.reviewer?.name ?? '—'}
                  </dd>
                  <dd className="text-xs text-muted-foreground">
                    {review.reviewer?.email}
                  </dd>
                </div>
                <div className="space-y-0.5">
                  <dt className="text-xs text-muted-foreground">Reviewee</dt>
                  <dd className="font-medium">
                    {review.reviewee?.name ?? '—'}
                  </dd>
                  <dd className="text-xs text-muted-foreground">
                    {review.reviewee?.email}
                  </dd>
                </div>
              </dl>

              {formError ? (
                <p className="text-sm text-destructive">{formError}</p>
              ) : null}

              <div className="flex flex-col gap-2">
                <Button
                  variant="outline"
                  disabled={toggleVisibility.isPending}
                  onClick={() => toggleVisibility.mutate()}
                >
                  {toggleVisibility.isPending
                    ? 'Saving…'
                    : review.isPublic
                      ? 'Hide from public'
                      : 'Make public'}
                </Button>

                {confirmDelete ? (
                  <div className="flex gap-2">
                    <Button
                      variant="destructive"
                      disabled={remove.isPending}
                      onClick={() => remove.mutate()}
                    >
                      {remove.isPending ? 'Deleting…' : 'Confirm delete'}
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={() => setConfirmDelete(false)}
                    >
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <Button
                    variant="ghost"
                    className="text-destructive"
                    onClick={() => setConfirmDelete(true)}
                  >
                    Delete review
                  </Button>
                )}
              </div>
            </div>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
