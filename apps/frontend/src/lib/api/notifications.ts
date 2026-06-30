import { apiFetch } from '../api';

export type NotificationType = 'JOB_EXPIRING';

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
