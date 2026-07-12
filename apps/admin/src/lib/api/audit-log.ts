import { apiFetch, buildQuery, type Paginated } from '../api';

export type AuditLogEntry = {
  id: string;
  actorId: string | null;
  action: string;
  entity: string;
  entityId: string;
  details: unknown;
  createdAt: string;
  actor: { id: string; name: string; email: string } | null;
};

export type ListAuditLogParams = {
  page?: number;
  limit?: number;
  entity?: string;
  entityId?: string;
  userId?: string;
};

export function listAuditLog(params: ListAuditLogParams = {}) {
  return apiFetch<Paginated<AuditLogEntry>>(
    `/admin/audit-log${buildQuery(params)}`,
  );
}
