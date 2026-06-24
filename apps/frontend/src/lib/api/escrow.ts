import { apiFetch } from '../api';

export type EscrowStatus =
  | 'REQUESTED'
  | 'FUNDED'
  | 'MATERIALS_RELEASED'
  | 'WORK_COMPLETED'
  | 'RELEASED'
  | 'REFUNDED'
  | 'CANCELLED';

export type EscrowPaymentMethod = 'card' | 'paypal' | 'local';

export type EscrowTransaction = {
  id: string;
  type: 'FUND' | 'RELEASE_MATERIALS' | 'RELEASE_BALANCE' | 'REFUND';
  amount: number;
  note: string | null;
  createdAt: string;
};

export type EscrowParty = {
  id: string;
  name: string;
  image: string | null;
};

export type Escrow = {
  id: string;
  jobId: string;
  quoteId: string;
  status: EscrowStatus;
  currency: string;
  quoteTotal: number;
  materialsAmount: number;
  depositAmount: number;
  balanceAmount: number;
  paymentMethod: EscrowPaymentMethod | null;
  fundedAt: string | null;
  materialsReleasedAt: string | null;
  workCompletedAt: string | null;
  releasedAt: string | null;
  refundedAt: string | null;
  createdAt: string;
  job: { id: string; title: string; status: string };
  homeowner: EscrowParty;
  tradesman: EscrowParty;
  transactions: EscrowTransaction[];
};

export function getEscrowForJob(jobId: string) {
  return apiFetch<Escrow>(`/jobs/${jobId}/escrow`);
}

export function getEscrow(id: string) {
  return apiFetch<Escrow>(`/escrows/${id}`);
}

export function fundEscrow(id: string, paymentMethod: EscrowPaymentMethod) {
  return apiFetch<Escrow>(`/escrows/${id}/fund`, {
    method: 'POST',
    body: JSON.stringify({ paymentMethod }),
  });
}

export function releaseMaterials(id: string) {
  return apiFetch<Escrow>(`/escrows/${id}/release-materials`, {
    method: 'POST',
  });
}

export function markWorkDone(id: string) {
  return apiFetch<Escrow>(`/escrows/${id}/work-done`, { method: 'POST' });
}

export function approveEscrow(id: string) {
  return apiFetch<Escrow>(`/escrows/${id}/approve`, { method: 'POST' });
}

export function refundEscrow(id: string) {
  return apiFetch<Escrow>(`/escrows/${id}/refund`, { method: 'POST' });
}

// Map an escrow status to the milestone-strip index (number of completed
// steps): Funded · Materials · Work done · Released.
export function escrowStripStep(status: EscrowStatus): number {
  switch (status) {
    case 'REQUESTED':
      return 0;
    case 'FUNDED':
      return 1;
    case 'MATERIALS_RELEASED':
      return 2;
    case 'WORK_COMPLETED':
      return 3;
    case 'RELEASED':
      return 4;
    default:
      return 0; // REFUNDED / CANCELLED — strip is shown as inactive
  }
}
