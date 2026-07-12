'use client';

import { useQuery } from '@tanstack/react-query';
import { adminKeys } from '../query-keys';
import {
  getOpenReports,
  getPendingVerifications,
  getActiveJobs,
} from '../api/admin';
import type { Paginated } from '../api';

// Pull just the count out of the paginated envelope (perf-select-transform):
// the component re-renders only when the total changes, not when unrelated
// fields of the response object are re-created.
const selectTotal = (res: Paginated<unknown>) => res.meta.total;

export function useOpenReportsCount() {
  return useQuery({
    queryKey: adminKeys.openReports(),
    queryFn: getOpenReports,
    select: selectTotal,
  });
}

export function usePendingVerificationsCount() {
  return useQuery({
    queryKey: adminKeys.pendingVerifications(),
    queryFn: getPendingVerifications,
    select: selectTotal,
  });
}

export function useActiveJobsCount() {
  return useQuery({
    queryKey: adminKeys.activeJobs(),
    queryFn: getActiveJobs,
    select: selectTotal,
  });
}
