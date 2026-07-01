import { apiFetch, buildQuery, type Paginated } from '../api';

export type JobStatus =
  | 'OPEN'
  | 'ASSIGNED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'EXPIRED';

export type JobUrgency = 'LOW' | 'MEDIUM' | 'HIGH' | 'EMERGENCY';

type Ref = { id: string; name: string; email?: string };
type CategoryRef = { id: string; slug: string; nameEn: string };

export type AdminJob = {
  id: string;
  title: string;
  status: JobStatus;
  urgency: JobUrgency;
  city: string | null;
  district: string | null;
  createdAt: string;
  category: CategoryRef | null;
  homeowner: Ref | null;
  assignedTradesman: Ref | null;
  _count: { quotes: number };
};

export type AdminJobDetail = Omit<AdminJob, '_count'> & {
  description: string;
  budgetMin: number | null;
  budgetMax: number | null;
  locationText: string | null;
  scheduledFor: string | null;
  expiresAt: string | null;
  updatedAt: string;
  category: CategoryRef | null;
  skills: { skill: { id: string; nameEn: string } }[];
  quotes: {
    id: string;
    amount: string | number;
    status: string;
    createdAt: string;
    tradesman: Ref | null;
  }[];
  escrow: { id: string; status: string; quoteTotal: string | number } | null;
  reports: {
    id: string;
    status: string;
    reason: string;
    targetType: string;
    createdAt: string;
  }[];
};

export type ListJobsParams = {
  page?: number;
  limit?: number;
  status?: JobStatus;
  urgency?: JobUrgency;
};

export function listJobs(params: ListJobsParams = {}) {
  return apiFetch<Paginated<AdminJob>>(`/admin/jobs${buildQuery(params)}`);
}

export function getJob(id: string) {
  return apiFetch<AdminJobDetail>(`/admin/jobs/${id}`);
}
