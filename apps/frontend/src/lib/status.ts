// Subset of the Badge `variant` union from @repo/ui that statusVariant returns
// (kept local so the frontend doesn't need class-variance-authority directly).
type BadgeVariant =
  | 'outline'
  | 'muted'
  | 'success'
  | 'warning'
  | 'info'
  | 'destructive';

// Map a job / quote / verification status to a semantic Badge variant so status
// pills read consistently across every screen. Matched case-insensitively so it
// works whether the API returns "OPEN" (Prisma enum) or "Open" (display label).
// Unknown statuses fall back to the neutral outline pill.
const STATUS_VARIANT: Record<string, BadgeVariant> = {
  open: 'info',
  pending: 'warning',
  'under review': 'info',
  under_review: 'info',
  assigned: 'warning',
  'in progress': 'warning',
  in_progress: 'warning',
  disputed: 'destructive',
  accepted: 'success',
  completed: 'success',
  verified: 'success',
  rejected: 'destructive',
  declined: 'destructive',
  cancelled: 'muted',
  canceled: 'muted',
  closed: 'muted',
};

export function statusVariant(status?: string | null): BadgeVariant {
  return STATUS_VARIANT[String(status ?? '').toLowerCase()] ?? 'outline';
}
