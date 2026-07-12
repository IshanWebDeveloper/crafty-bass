import { apiFetch, buildQuery, type Paginated } from '../api';

export type VerificationStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

type VerificationUser = {
  id: string;
  name: string;
  email: string;
  image: string | null;
  phone?: string | null;
  createdAt?: string;
};

// A row in the pending queue (GET /verification/pending). Includes the light
// applicant summary; the full submission comes from getVerification.
export type VerificationListItem = {
  id: string;
  userId: string;
  status: VerificationStatus;
  fullName: string | null;
  primaryTrade: string | null;
  city: string | null;
  district: string | null;
  createdAt: string;
  user: VerificationUser | null;
};

// The full submission returned by GET /verification/:id. Document *keys* are
// present but not directly viewable - call getVerificationDocuments for URLs.
export type VerificationDetail = VerificationListItem & {
  gender: string | null;
  dateOfBirth: string | null;
  nicNumber: string | null;
  addressLine: string | null;
  yearsExperience: number | null;
  licenceNumber: string | null;
  serviceRadiusKm: number | null;
  crewType: string | null;
  helperCount: number | null;
  guarantorName: string | null;
  guarantorNic: string | null;
  payoutAccountHolder: string | null;
  payoutBank: string | null;
  payoutBranch: string | null;
  payoutAccountNumber: string | null;
  rejectionReason: string | null;
  reviewedAt: string | null;
  reviewedBy: { id: string; name: string; email: string } | null;
  updatedAt: string;
};

export type VerificationDocument = {
  field: string;
  label: string;
  url: string;
};

export type VerificationDocuments = {
  documents: VerificationDocument[];
  expiresInSeconds: number;
};

export type ListVerificationsParams = {
  page?: number;
  limit?: number;
};

export function listPendingVerifications(params: ListVerificationsParams = {}) {
  return apiFetch<Paginated<VerificationListItem>>(
    `/verification/pending${buildQuery(params)}`,
  );
}

export function getVerification(id: string) {
  return apiFetch<VerificationDetail>(`/verification/${id}`);
}

export function getVerificationDocuments(id: string) {
  return apiFetch<VerificationDocuments>(`/verification/${id}/documents`);
}

export function approveVerification(id: string) {
  return apiFetch<VerificationDetail>(`/verification/${id}/approve`, {
    method: 'POST',
  });
}

export function rejectVerification(id: string, reason: string) {
  return apiFetch<VerificationDetail>(`/verification/${id}/reject`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });
}
