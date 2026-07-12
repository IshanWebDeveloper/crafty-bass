import { apiFetch } from '../api';

// Mirrors AdminService.getMetrics on the backend.
export type AdminMetrics = {
  users: {
    total: number;
    homeowners: number;
    tradesmen: number;
    banned: number;
    newLast30Days: number;
  };
  jobs: {
    total: number;
    open: number;
    assigned: number;
    inProgress: number;
    disputed: number;
    completed: number;
    cancelled: number;
    expired: number;
  };
  quotes: {
    total: number;
    pending: number;
    accepted: number;
  };
  moderation: {
    openReports: number;
    underReviewReports: number;
    pendingVerifications: number;
    hiddenReviews: number;
  };
  escrow: {
    activeCount: number;
    activeValue: number;
    currency: string;
  };
  series: { date: string; jobs: number; signups: number }[];
};

export function getMetrics() {
  return apiFetch<AdminMetrics>('/admin/metrics');
}
