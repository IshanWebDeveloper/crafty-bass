import { apiFetch, buildQuery, type Paginated } from '../api';

export type ReportStatus = 'OPEN' | 'UNDER_REVIEW' | 'RESOLVED' | 'DISMISSED';
export type ReportTargetType = 'USER' | 'JOB' | 'QUOTE' | 'REVIEW' | 'MESSAGE';

type PartyRef = { id: string; name: string; image: string | null };

export type Report = {
  id: string;
  reporterId: string;
  assigneeId: string | null;
  targetType: ReportTargetType;
  targetId: string;
  reason: string;
  status: ReportStatus;
  resolutionNotes: string | null;
  resolvedAt: string | null;
  jobId: string | null;
  messageId: string | null;
  reviewId: string | null;
  createdAt: string;
  updatedAt: string;
  reporter: PartyRef | null;
  assignee: PartyRef | null;
};

export type ListReportsParams = {
  page?: number;
  limit?: number;
  status?: ReportStatus;
  targetType?: ReportTargetType;
  assigneeId?: string;
};

export function listReports(params: ListReportsParams = {}) {
  return apiFetch<Paginated<Report>>(`/reports${buildQuery(params)}`);
}

export function getReport(id: string) {
  return apiFetch<Report>(`/reports/${id}`);
}

export type UpdateReportInput = {
  status?: ReportStatus;
  assigneeId?: string | null;
  resolutionNotes?: string;
};

export function updateReport(id: string, input: UpdateReportInput) {
  return apiFetch<Report>(`/reports/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}
