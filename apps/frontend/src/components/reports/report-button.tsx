'use client';

import { useEffect, useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Button } from '@repo/ui';
import { toast } from 'sonner';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { createReport, type ReportTargetType } from '@/lib/api/reports';
import { ApiError } from '@/lib/api';
import type { Dictionary } from '@/i18n/dictionaries';

export function ReportButton({
  targetType,
  targetId,
  dict,
  size = 'sm',
  variant = 'ghost',
}: {
  targetType: ReportTargetType;
  targetId: string;
  dict: Dictionary;
  size?: 'sm' | 'default' | 'lg';
  variant?: 'ghost' | 'outline' | 'default';
}) {
  const t = dict.reports;
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  const mutation = useMutation({
    mutationFn: () => createReport({ targetType, targetId, reason }),
    onSuccess: () => {
      toast.success(t.modal.success);
      setReason('');
      setOpen(false);
    },
    onError: (err) => {
      if (err instanceof ApiError && err.status === 409) {
        toast.info(t.modal.alreadyReported);
        setOpen(false);
        return;
      }
      toast.error(err instanceof Error ? err.message : 'Failed to file report');
    },
  });

  return (
    <>
      <Button
        type="button"
        size={size}
        variant={variant}
        onClick={() => setOpen(true)}
      >
        {t.openButton}
      </Button>
      <dialog
        ref={dialogRef}
        onClose={() => setOpen(false)}
        className="m-auto w-full max-w-md rounded-xl border border-border bg-card text-card-foreground shadow-lg backdrop:bg-foreground/30"
      >
        <form
          method="dialog"
          onSubmit={(e) => {
            e.preventDefault();
            if (reason.trim().length < 10) {
              toast.error(t.modal.reasonPlaceholder);
              return;
            }
            mutation.mutate();
          }}
          className="space-y-4 p-6"
        >
          <div>
            <h3 className="text-lg font-semibold">{t.modal.title}</h3>
            <p className="text-sm text-muted-foreground">
              {t.modal.subtitle} ({t.targetTypes[targetType]})
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="report-reason">{t.modal.reason}</Label>
            <Textarea
              id="report-reason"
              rows={4}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={t.modal.reasonPlaceholder}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              {t.modal.cancel}
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? t.modal.submitting : t.modal.submit}
            </Button>
          </div>
        </form>
      </dialog>
    </>
  );
}
