import { apiFetch } from '../api';

export type ReportStatus = 'OPEN' | 'UNDER_REVIEW' | 'RESOLVED' | 'DISMISSED';
export type ReportTargetType = 'USER' | 'JOB' | 'QUOTE' | 'REVIEW' | 'MESSAGE';

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
  reporter: { id: string; name: string; image: string | null };
  assignee: { id: string; name: string; image: string | null } | null;
};

export type Paginated<T> = {
  data: T[];
  meta: { total: number; page: number; limit: number; lastPage: number };
};

export type CreateReportBody = {
  targetType: ReportTargetType;
  targetId: string;
  reason: string;
};

export function createReport(body: CreateReportBody) {
  return apiFetch<Report>('/reports', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function listMyReports() {
  return apiFetch<Paginated<Report>>('/reports/mine?limit=50');
}
