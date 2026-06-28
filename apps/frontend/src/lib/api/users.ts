import { apiFetch } from '../api';

export type DashboardSummary = {
  recentPostedJobs: Array<{
    id: string;
    title: string;
    status: string;
    createdAt: string;
    category: { nameEn: string; slug: string } | null;
  }>;
  totalPostedJobs: number;
  activePostedJobs: number;
  assignedJobs: number;
  reviewsReceived: number;
};

export function getDashboard() {
  return apiFetch<DashboardSummary>('/users/me/dashboard');
}

export type Me = {
  id: string;
  name: string;
  email: string;
  image: string | null;
  role: 'CUSTOMER' | 'SUPPORT' | 'ADMIN';
  userType: 'HOMEOWNER' | 'TRADESMAN' | null;
  phone: string | null;
  primaryTrade: string | null;
};

export function getMe() {
  return apiFetch<Me>('/users/me');
}
