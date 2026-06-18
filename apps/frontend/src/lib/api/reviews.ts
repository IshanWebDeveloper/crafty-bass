import { apiFetch } from '../api';

export type Review = {
  id: string;
  jobId: string;
  reviewerId: string;
  revieweeId: string;
  rating: number;
  title: string | null;
  comment: string | null;
  isPublic: boolean;
  createdAt: string;
  updatedAt: string;
  reviewer: { id: string; name: string; image: string | null };
};

export type ReviewWithJob = Review & {
  job: { id: string; title: string };
};

export type Paginated<T> = {
  data: T[];
  meta: { total: number; page: number; limit: number; lastPage: number };
};

export function listReviewsForJob(jobId: string) {
  return apiFetch<Paginated<Review>>(`/jobs/${jobId}/reviews`);
}

export function listMyReviewsReceived() {
  return apiFetch<ReviewWithJob[]>('/reviews/received');
}

export type CreateReviewBody = {
  rating: number;
  title?: string;
  comment?: string;
};

export function createReview(jobId: string, body: CreateReviewBody) {
  return apiFetch<Review>(`/jobs/${jobId}/reviews`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}
