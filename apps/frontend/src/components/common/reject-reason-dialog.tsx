'use client';

import { useEffect, useRef, useState } from 'react';
import { Button } from '@repo/ui';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

// Copy for one reject/decline/cancel prompt. Each call site passes the strings
// from its own i18n namespace (e.g. dict.quotes.rejectDialog).
export type RejectReasonCopy = {
  title: string;
  description?: string;
  label: string;
  placeholder: string;
  cancel: string;
  submit: string;
  submitting: string;
};

/**
 * A small controlled modal that captures a required reason before a destructive
 * action (rejecting a quote, declining a material request, cancelling a job).
 * Uses the native <dialog> element - the same pattern as ReportButton - so it
 * traps focus and closes on Escape without a modal library. The parent owns the
 * mutation and closes the dialog (sets `open` false) on success.
 */
export function RejectReasonDialog({
  open,
  onOpenChange,
  onSubmit,
  pending = false,
  copy,
  minLength = 3,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (reason: string) => void;
  pending?: boolean;
  copy: RejectReasonCopy;
  minLength?: number;
}) {
  const [reason, setReason] = useState('');
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  const tooShort = reason.trim().length < minLength;

  return (
    <dialog
      ref={dialogRef}
      onClose={() => {
        // Fires on Escape or el.close() - clear so the next open starts blank.
        setReason('');
        onOpenChange(false);
      }}
      className="m-auto w-full max-w-md rounded-xl border border-border bg-card text-card-foreground shadow-lg backdrop:bg-foreground/30"
    >
      <form
        method="dialog"
        onSubmit={(e) => {
          e.preventDefault();
          if (tooShort) return;
          onSubmit(reason.trim());
        }}
        className="space-y-4 p-6"
      >
        <div className="space-y-1">
          <h3 className="text-lg font-semibold">{copy.title}</h3>
          {copy.description ? (
            <p className="text-sm text-muted-foreground">{copy.description}</p>
          ) : null}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="reject-reason">{copy.label}</Label>
          <Textarea
            id="reject-reason"
            rows={4}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={copy.placeholder}
            autoFocus
          />
        </div>
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            {copy.cancel}
          </Button>
          <Button type="submit" disabled={pending || tooShort}>
            {pending ? copy.submitting : copy.submit}
          </Button>
        </div>
      </form>
    </dialog>
  );
}
