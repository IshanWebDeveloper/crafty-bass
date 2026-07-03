import { apiFetch } from '../api';

// Categories accepted by the backend POST /uploads endpoint. Each maps to a
// storage prefix + allowed MIME/size on the server.
export type UploadCategory = 'kyc' | 'avatar' | 'portfolio' | 'voice-intro';

export type UploadResult = {
  // Object key stored in R2; persist this (e.g. as a verification document key).
  key: string;
  // Short-lived presigned URL for an immediate preview/thumbnail.
  url: string;
};

// Uploads a single file through the same-origin /api proxy. apiFetch leaves the
// Content-Type unset for FormData so the browser sets the multipart boundary.
export function uploadFile(
  file: File,
  category: UploadCategory,
): Promise<UploadResult> {
  const body = new FormData();
  body.append('file', file);
  body.append('category', category);
  return apiFetch<UploadResult>('/uploads', { method: 'POST', body });
}
