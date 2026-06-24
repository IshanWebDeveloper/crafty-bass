import { apiFetch } from '../api';

export type VerificationStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export type Verification = {
  id: string;
  userId: string;
  status: VerificationStatus;
  fullName: string;
  nicNumber: string;
  primaryTrade: string | null;
  district: string | null;
  policeClearanceKey: string | null;
  rejectionReason: string | null;
  createdAt: string;
  updatedAt: string;
};

// Document fields hold storage references; the binary upload is deferred, so the
// wizard sends a placeholder key string for any document the tradesman marks as
// provided. Only police-clearance presence affects the badge tier.
export type SubmitVerificationBody = {
  fullName: string;
  gender?: string;
  dateOfBirth?: string;
  nicNumber: string;
  addressLine?: string;
  city?: string;
  district?: string;
  primaryTrade?: string;
  yearsExperience?: number;
  nicFrontKey?: string;
  nicBackKey?: string;
  photoKey?: string;
  gramaNiladhariKey?: string;
  licenceKey?: string;
  licenceNumber?: string;
  policeClearanceKey?: string;
  serviceRadiusKm?: number;
  crewType?: 'solo' | 'team';
  helperCount?: number;
  guarantorName?: string;
  guarantorNic?: string;
  payoutAccountHolder?: string;
  payoutBank?: string;
  payoutBranch?: string;
  payoutAccountNumber?: string;
};

export function getMyVerification() {
  return apiFetch<Verification | null>('/verification/me');
}

export function submitVerification(body: SubmitVerificationBody) {
  return apiFetch<Verification>('/verification', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}
