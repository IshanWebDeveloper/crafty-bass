'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PackagePlus } from 'lucide-react';
import { Badge, Button, Input, Skeleton } from '@repo/ui';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  listMaterialRequests,
  createMaterialRequest,
  approveMaterialRequest,
  declineMaterialRequest,
  type MaterialRequestStatus,
} from '@/lib/api/material-requests';
import type { Locale } from '@/i18n/config';
import type { Dictionary } from '@/i18n/dictionaries';

const STATUS_VARIANT: Record<
  MaterialRequestStatus,
  'warning' | 'success' | 'muted'
> = {
  PENDING: 'warning',
  APPROVED: 'success',
  DECLINED: 'muted',
};

/**
 * Mid-job material/tool requests. The assigned tradesman can raise a request
 * while the job is active (`canRequest`); the homeowner can approve or decline
 * pending ones (`canRespond`). Both see the running list.
 */
export function MaterialRequestsPanel({
  jobId,
  canRequest,
  canRespond,
  locale,
  dict,
}: {
  jobId: string;
  canRequest: boolean;
  canRespond: boolean;
  locale: Locale;
  dict: Dictionary;
}) {
  const qc = useQueryClient();
  const t = dict.materialRequests;
  const [note, setNote] = useState('');
  const [estimatedCost, setEstimatedCost] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['material-requests', jobId],
    queryFn: () => listMaterialRequests(jobId),
  });

  const invalidate = () =>
    qc.invalidateQueries({ queryKey: ['material-requests', jobId] });

  const create = useMutation({
    mutationFn: () =>
      createMaterialRequest(jobId, {
        note: note.trim(),
        estimatedCost: estimatedCost ? Number(estimatedCost) : undefined,
      }),
    onSuccess: () => {
      toast.success(t.success);
      setNote('');
      setEstimatedCost('');
      void invalidate();
    },
    onError: (err) =>
      toast.error(
        err instanceof Error ? err.message : 'Failed to send request',
      ),
  });

  const respond = useMutation({
    mutationFn: ({ id, approve }: { id: string; approve: boolean }) =>
      approve ? approveMaterialRequest(id) : declineMaterialRequest(id),
    onSuccess: (_data, vars) => {
      toast.success(vars.approve ? t.approved : t.declined);
      void invalidate();
    },
    onError: (err) =>
      toast.error(err instanceof Error ? err.message : 'Failed to respond'),
  });

  const requests = data ?? [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <PackagePlus className="size-5 text-muted-foreground" aria-hidden />
          {t.heading}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {canRequest ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (note.trim().length >= 3) create.mutate();
            }}
            className="space-y-3 rounded-lg border border-border p-4"
          >
            <div className="space-y-1.5">
              <Label htmlFor="mr-note">{t.note}</Label>
              <Textarea
                id="mr-note"
                rows={2}
                placeholder={t.notePlaceholder}
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </div>
            <div className="flex flex-wrap items-end gap-3">
              <div className="flex-1 space-y-1.5">
                <Label htmlFor="mr-cost">{t.estimatedCost}</Label>
                <Input
                  id="mr-cost"
                  type="number"
                  min={0}
                  step="0.01"
                  value={estimatedCost}
                  onChange={(e) => setEstimatedCost(e.target.value)}
                />
              </div>
              <Button
                type="submit"
                disabled={note.trim().length < 3 || create.isPending}
              >
                {create.isPending ? t.submitting : t.submit}
              </Button>
            </div>
          </form>
        ) : null}

        {isLoading ? (
          <Skeleton className="h-16 rounded-lg" />
        ) : requests.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t.empty}</p>
        ) : (
          <ul className="divide-y divide-border">
            {requests.map((r) => (
              <li key={r.id} className="flex gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">
                      {r.requestedBy.name}
                    </span>
                    <Badge variant={STATUS_VARIANT[r.status]}>
                      {t.statusLabels[r.status]}
                    </Badge>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{r.note}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {r.estimatedCost != null
                      ? `${r.currency} ${Number(r.estimatedCost).toLocaleString()} · `
                      : ''}
                    {new Date(r.createdAt).toLocaleDateString(locale)}
                  </p>
                </div>
                {canRespond && r.status === 'PENDING' ? (
                  <div className="flex shrink-0 flex-col gap-2">
                    <Button
                      size="sm"
                      onClick={() =>
                        respond.mutate({ id: r.id, approve: true })
                      }
                      disabled={respond.isPending}
                    >
                      {t.approve}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        respond.mutate({ id: r.id, approve: false })
                      }
                      disabled={respond.isPending}
                    >
                      {t.decline}
                    </Button>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
