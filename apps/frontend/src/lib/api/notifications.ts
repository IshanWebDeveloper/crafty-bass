import { apiFetch } from '../api';

// Mirrors the backend NotificationType enum (packages/db schema). JOB_EXPIRING
// warns tradesmen of a lapsing job; the rest track a job through its lifecycle.
export type NotificationType =
  | 'JOB_EXPIRING'
  | 'QUOTE_RECEIVED'
  | 'QUOTE_ACCEPTED'
  | 'QUOTE_DECLINED'
  | 'ESCROW_FUNDED'
  | 'WORK_STARTED'
  | 'WORK_COMPLETED'
  | 'JOB_COMPLETED'
  | 'JOB_CANCELLED'
  | 'JOB_EXPIRED';

// Backend notification record (see NotificationsService.toDto). Dynamic copy
// (title/body) is English; the client derives icon/tint/group/time for display.
export type ApiNotification = {
  id: string;
  type: NotificationType;
  title: string;
  body: string | null;
  href: string | null;
  jobId: string | null;
  read: boolean;
  createdAt: string;
};

export function listNotifications() {
  return apiFetch<ApiNotification[]>('/notifications');
}

export function markNotificationRead(id: string) {
  return apiFetch<{ updated: number }>(`/notifications/${id}/read`, {
    method: 'PATCH',
  });
}

export function markAllNotificationsRead() {
  return apiFetch<{ updated: number }>('/notifications/read-all', {
    method: 'PATCH',
  });
}
