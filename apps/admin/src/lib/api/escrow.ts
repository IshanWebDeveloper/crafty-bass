import { apiFetch, buildQuery, type Paginated } from '../api';

export type EscrowStatus =
  | 'REQUESTED'
  | 'FUNDED'
  | 'MATERIALS_RELEASED'
  | 'WORK_COMPLETED'
  | 'RELEASED'
  | 'REFUNDED'
  | 'CANCELLED';

type Party = { id: string; name: string; image: string | null };
type JobRef = { id: string; title: string; status: string };

export type AdminEscrow = {
  id: string;
  jobId: string;
  status: EscrowStatus;
  currency: string;
  quoteTotal: number;
  depositAmount: number;
  balanceAmount: number;
  fundedAt: string | null;
  releasedAt: string | null;
  refundedAt: string | null;
  createdAt: string;
  job: JobRef | null;
  homeowner: Party | null;
  tradesman: Party | null;
};

export type EscrowTransaction = {
  id: string;
  type: string;
  amount: number;
  note: string | null;
  createdAt: string;
};

export type AdminEscrowDetail = AdminEscrow & {
  quoteId: string;
  materialsAmount: number;
  paymentMethod: string | null;
  materialsReleasedAt: string | null;
  workCompletedAt: string | null;
  transactions: EscrowTransaction[];
};

export type ListEscrowsParams = {
  page?: number;
  limit?: number;
  status?: EscrowStatus;
};

export function listEscrows(params: ListEscrowsParams = {}) {
  return apiFetch<Paginated<AdminEscrow>>(
    `/admin/escrows${buildQuery(params)}`,
  );
}

export function getEscrow(id: string) {
  return apiFetch<AdminEscrowDetail>(`/escrows/${id}`);
}

export function refundEscrow(id: string) {
  return apiFetch<AdminEscrowDetail>(`/escrows/${id}/refund`, {
    method: 'POST',
  });
}

export type ResolveDisputeInput = {
  refundAmount: number;
  resolutionNotes?: string;
};

// Support/admin mediation for a disputed job: cancel it and refund some/all of
// the deposit in one step.
export function resolveDispute(id: string, input: ResolveDisputeInput) {
  return apiFetch<AdminEscrowDetail>(`/admin/escrows/${id}/resolve-dispute`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}
