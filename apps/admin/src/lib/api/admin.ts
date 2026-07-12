import { apiFetch, type Paginated } from '../api';

// The dashboard only needs the totals, so we request `limit=1` - the backend's
// paginated list endpoints all return `meta.total` regardless of page size, so
// this keeps the payload tiny while still giving an exact count. The row shape
// is irrelevant here, hence `Paginated<unknown>`.

export function getOpenReports() {
  return apiFetch<Paginated<unknown>>('/reports?status=OPEN&limit=1');
}

export function getPendingVerifications() {
  return apiFetch<Paginated<unknown>>('/verification/pending?limit=1');
}

export function getActiveJobs() {
  return apiFetch<Paginated<unknown>>('/jobs?status=IN_PROGRESS&limit=1');
}
