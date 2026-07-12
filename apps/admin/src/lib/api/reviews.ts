import { apiFetch, buildQuery, type Paginated } from '../api';

type Party = { id: string; name: string; email: string };

export type AdminReview = {
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
  reviewer: Party | null;
  reviewee: Party | null;
  job: { id: string; title: string } | null;
};

export type ListReviewsParams = {
  page?: number;
  limit?: number;
  rating?: number;
  revieweeId?: string;
  sortBy?: 'rating' | 'createdAt' | 'updatedAt';
  order?: 'asc' | 'desc';
};

export function listReviews(params: ListReviewsParams = {}) {
  return apiFetch<Paginated<AdminReview>>(
    `/admin/reviews${buildQuery(params)}`,
  );
}

export function getReview(id: string) {
  return apiFetch<AdminReview>(`/admin/reviews/${id}`);
}

export type ModerateReviewInput = {
  isPublic?: boolean;
  rating?: number;
  title?: string | null;
  comment?: string | null;
};

export function moderateReview(id: string, input: ModerateReviewInput) {
  return apiFetch<AdminReview>(`/admin/reviews/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export function deleteReview(id: string) {
  return apiFetch<AdminReview>(`/admin/reviews/${id}`, {
    method: 'DELETE',
  });
}
