import { apiFetch } from '../api';

export type MaterialRequestStatus = 'PENDING' | 'APPROVED' | 'DECLINED';

export type MaterialRequest = {
  id: string;
  jobId: string;
  requestedById: string;
  note: string;
  estimatedCost: number | null;
  currency: string;
  status: MaterialRequestStatus;
  declineReason: string | null;
  respondedAt: string | null;
  createdAt: string;
  requestedBy: { id: string; name: string; image: string | null };
};

export type CreateMaterialRequestBody = {
  note: string;
  estimatedCost?: number;
  currency?: string;
};

export function listMaterialRequests(jobId: string) {
  return apiFetch<MaterialRequest[]>(`/jobs/${jobId}/material-requests`);
}

export function createMaterialRequest(
  jobId: string,
  body: CreateMaterialRequestBody,
) {
  return apiFetch<MaterialRequest>(`/jobs/${jobId}/material-requests`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function approveMaterialRequest(id: string) {
  return apiFetch<MaterialRequest>(`/material-requests/${id}/approve`, {
    method: 'PATCH',
  });
}

export function declineMaterialRequest(id: string, reason: string) {
  return apiFetch<MaterialRequest>(`/material-requests/${id}/decline`, {
    method: 'PATCH',
    body: JSON.stringify({ reason }),
  });
}
