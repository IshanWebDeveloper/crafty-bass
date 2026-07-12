import { apiFetch } from '../api';

export type JobUrgency = 'LOW' | 'MEDIUM' | 'HIGH' | 'EMERGENCY';
export type JobStatus =
  | 'OPEN'
  | 'ASSIGNED'
  | 'IN_PROGRESS'
  | 'DISPUTED'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'EXPIRED';
export type LanguageCode = 'EN' | 'SI' | 'TA';
export type TaskSize = 'SMALL' | 'MEDIUM' | 'LARGE';
export type VehicleRequirement = 'NONE' | 'CAR' | 'TRUCK';

export type JobListItem = {
  id: string;
  title: string;
  description: string;
  status: JobStatus;
  urgency: JobUrgency;
  city: string | null;
  district: string | null;
  budgetMin: number | null;
  budgetMax: number | null;
  scheduledFor: string | null;
  taskSize: TaskSize | null;
  vehicleRequirement: VehicleRequirement | null;
  expiresAt: string | null;
  createdAt: string;
  assignedTradesmanId: string | null;
  category: { id: string; slug: string; nameEn: string } | null;
  homeowner: { id: string; name: string };
  _count: { quotes: number };
};

export type Job = JobListItem & {
  skills: Array<{
    skillId: string;
    source: string;
    skill: { id: string; slug: string; nameEn: string };
  }>;
};

// Agreed terms for an assigned job (GET /jobs/:id/agreement). Party-only, so
// this is a separate authenticated fetch rather than part of the public job
// payload. Either field is null until a quote has been accepted.
export type JobAgreement = {
  assignedTradesman: { id: string; name: string; image: string | null } | null;
  acceptedQuote: {
    id: string;
    amount: number;
    currency: string;
    depositRequested: number | null;
    estimatedStart: string | null;
    estimatedCompletion: string | null;
    message: string | null;
  } | null;
};

export type Paginated<T> = {
  data: T[];
  meta: { total: number; page: number; limit: number; lastPage: number };
};

export type CreateJobBody = {
  title: string;
  description: string;
  descriptionLanguage: LanguageCode;
  categoryId?: string;
  skillIds?: string[];
  locationText?: string;
  city?: string;
  district?: string;
  latitude?: number;
  longitude?: number;
  budgetMin?: number;
  budgetMax?: number;
  scheduledFor?: string;
  urgency: JobUrgency;
  taskSize?: TaskSize;
  vehicleRequirement?: VehicleRequirement;
};

// Editing a posted job: every field is optional (a partial patch), and
// categoryId can be explicitly null to clear the category. Mirrors the
// backend UpdateJobSchema.
export type UpdateJobBody = {
  title?: string;
  description?: string;
  categoryId?: string | null;
  locationText?: string;
  city?: string;
  district?: string;
  budgetMin?: number;
  budgetMax?: number;
  scheduledFor?: string;
  urgency?: JobUrgency;
  taskSize?: TaskSize;
  vehicleRequirement?: VehicleRequirement;
};

// Public landing-page marketplace counts (GET /jobs/stats).
export type JobStats = {
  openJobs: number;
  matchedJobs: number;
  verifiedTradespeople: number;
};

export type JobListQuery = {
  page?: number;
  limit?: number;
  categoryId?: string;
  district?: string;
  city?: string;
  urgency?: JobUrgency;
  status?: JobStatus;
};

function toSearch(query: Record<string, string | number | undefined>) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== '') params.set(key, String(value));
  }
  const s = params.toString();
  return s ? `?${s}` : '';
}

export function browseJobs(query: JobListQuery = {}) {
  return apiFetch<Paginated<JobListItem>>(`/jobs${toSearch(query)}`);
}

export function listMyJobs(query: JobListQuery = {}) {
  return apiFetch<Paginated<JobListItem>>(`/jobs/mine${toSearch(query)}`);
}

export function getJob(id: string) {
  return apiFetch<Job>(`/jobs/${id}`);
}

export function getJobAgreement(id: string) {
  return apiFetch<JobAgreement>(`/jobs/${id}/agreement`);
}

export function createJob(body: CreateJobBody) {
  return apiFetch<Job>('/jobs', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function updateJob(id: string, body: UpdateJobBody) {
  return apiFetch<Job>(`/jobs/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

export function cancelJob(id: string) {
  return apiFetch<Job>(`/jobs/${id}/cancel`, { method: 'PATCH' });
}
