import { Badge } from '@repo/ui';

// Shared badge styling for the moderation status enums the admin tables render.
// Keeping the status→variant map in one place means Reports, Verifications and
// Jobs colour a given state identically.

type Variant = React.ComponentProps<typeof Badge>['variant'];

const REPORT_STATUS: Record<string, { label: string; variant: Variant }> = {
  OPEN: { label: 'Open', variant: 'warning' },
  UNDER_REVIEW: { label: 'Under review', variant: 'info' },
  RESOLVED: { label: 'Resolved', variant: 'success' },
  DISMISSED: { label: 'Dismissed', variant: 'muted' },
};

export function ReportStatusBadge({ status }: { status: string }) {
  const s = REPORT_STATUS[status] ?? { label: status, variant: 'muted' };
  return <Badge variant={s.variant}>{s.label}</Badge>;
}

const VERIFICATION_STATUS: Record<string, { label: string; variant: Variant }> =
  {
    PENDING: { label: 'Pending', variant: 'warning' },
    APPROVED: { label: 'Approved', variant: 'success' },
    REJECTED: { label: 'Rejected', variant: 'destructive' },
  };

export function VerificationStatusBadge({ status }: { status: string }) {
  const s = VERIFICATION_STATUS[status] ?? { label: status, variant: 'muted' };
  return <Badge variant={s.variant}>{s.label}</Badge>;
}

const JOB_STATUS: Record<string, { label: string; variant: Variant }> = {
  OPEN: { label: 'Open', variant: 'info' },
  ASSIGNED: { label: 'Assigned', variant: 'default' },
  IN_PROGRESS: { label: 'In progress', variant: 'default' },
  DISPUTED: { label: 'Under review', variant: 'destructive' },
  COMPLETED: { label: 'Completed', variant: 'success' },
  CANCELLED: { label: 'Cancelled', variant: 'muted' },
  EXPIRED: { label: 'Expired', variant: 'muted' },
};

export function JobStatusBadge({ status }: { status: string }) {
  const s = JOB_STATUS[status] ?? { label: status, variant: 'muted' };
  return <Badge variant={s.variant}>{s.label}</Badge>;
}

const ESCROW_STATUS: Record<string, { label: string; variant: Variant }> = {
  REQUESTED: { label: 'Requested', variant: 'muted' },
  FUNDED: { label: 'Funded', variant: 'info' },
  MATERIALS_RELEASED: { label: 'Materials released', variant: 'info' },
  WORK_COMPLETED: { label: 'Work completed', variant: 'info' },
  RELEASED: { label: 'Released', variant: 'success' },
  REFUNDED: { label: 'Refunded', variant: 'warning' },
  CANCELLED: { label: 'Cancelled', variant: 'muted' },
};

export function EscrowStatusBadge({ status }: { status: string }) {
  const s = ESCROW_STATUS[status] ?? { label: status, variant: 'muted' };
  return <Badge variant={s.variant}>{s.label}</Badge>;
}
