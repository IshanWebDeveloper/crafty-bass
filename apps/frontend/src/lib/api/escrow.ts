import { apiFetch, API_BASE_URL, ApiError } from '../api';

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
  // Up-front processing fee and what the homeowner pays at funding (deposit + fee).
  processingFee: number;
  amountDue: number;
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

export type FundEscrowResult = Escrow & {
  requiresAction?: boolean;
  clientSecret?: string;
};

export function fundEscrow(
  id: string,
  paymentMethod: EscrowPaymentMethod,
  stripePaymentMethodId?: string,
) {
  return apiFetch<FundEscrowResult>(`/escrows/${id}/fund`, {
    method: 'POST',
    body: JSON.stringify({ paymentMethod, stripePaymentMethodId }),
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

/**
 * Fetches the funded deposit's invoice PDF and triggers a browser download.
 * The endpoint streams a binary with a Content-Disposition filename, so this
 * goes around apiFetch (which assumes JSON/text) but keeps the same
 * same-origin, cookie-credentialed fetch and ApiError normalization.
 */
export async function downloadEscrowInvoice(id: string): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/escrows/${id}/invoice`, {
    credentials: 'include',
  });
  if (!res.ok) {
    let body: unknown;
    try {
      body = await res.json();
    } catch {
      // non-JSON error body
    }
    const message =
      (body as { message?: string } | undefined)?.message ??
      `Failed to download invoice (status ${res.status})`;
    throw new ApiError(res.status, message, body);
  }
  const blob = await res.blob();
  const filename =
    parseFilename(res.headers.get('content-disposition')) ??
    `crafty-bass-invoice-${id}.pdf`;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// Pulls the filename out of a Content-Disposition header, if present.
function parseFilename(disposition: string | null): string | null {
  if (!disposition) return null;
  const match = /filename="?([^"]+)"?/.exec(disposition);
  return match?.[1] ?? null;
}

/** Emails the deposit invoice to the requesting party ("email me a copy"). */
export function emailEscrowInvoice(id: string) {
  return apiFetch<{ sent: boolean; email: string }>(
    `/escrows/${id}/invoice/email`,
    { method: 'POST' },
  );
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
      return 0; // REFUNDED / CANCELLED - strip is shown as inactive
  }
}
