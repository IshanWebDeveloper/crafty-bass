'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { type ColumnDef } from '@tanstack/react-table';
import {
  Badge,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@repo/ui';
import { adminKeys } from '@/lib/query-keys';
import { DataTable } from '@/components/data-table';
import { JobStatusBadge } from '@/components/status-badge';
import {
  listJobs,
  type AdminJob,
  type JobStatus,
  type ListJobsParams,
} from '@/lib/api/jobs';

const PAGE_SIZE = 20;

const STATUS_FILTERS = [
  { value: 'all', label: 'All statuses' },
  { value: 'OPEN', label: 'Open' },
  { value: 'ASSIGNED', label: 'Assigned' },
  { value: 'IN_PROGRESS', label: 'In progress' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'CANCELLED', label: 'Cancelled' },
  { value: 'EXPIRED', label: 'Expired' },
];

const URGENCY_VARIANT: Record<
  string,
  'muted' | 'info' | 'warning' | 'destructive'
> = {
  LOW: 'muted',
  MEDIUM: 'info',
  HIGH: 'warning',
  EMERGENCY: 'destructive',
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function JobsManager() {
  const router = useRouter();
  const [status, setStatus] = useState('all');
  const [page, setPage] = useState(1);

  const params: ListJobsParams = useMemo(
    () => ({
      page,
      limit: PAGE_SIZE,
      ...(status !== 'all' ? { status: status as JobStatus } : {}),
    }),
    [page, status],
  );

  const { data, isPending, isError, error } = useQuery({
    queryKey: adminKeys.jobsList(params),
    queryFn: () => listJobs(params),
  });

  const columns = useMemo<ColumnDef<AdminJob, unknown>[]>(
    () => [
      {
        header: 'Title',
        cell: ({ row }) => (
          <div className="max-w-xs">
            <span className="line-clamp-1 font-medium">
              {row.original.title}
            </span>
            <span className="block text-xs text-muted-foreground">
              {row.original.category?.nameEn ?? 'Uncategorised'}
            </span>
          </div>
        ),
      },
      {
        header: 'Status',
        cell: ({ row }) => <JobStatusBadge status={row.original.status} />,
      },
      {
        header: 'Urgency',
        cell: ({ row }) => (
          <Badge variant={URGENCY_VARIANT[row.original.urgency] ?? 'muted'}>
            {row.original.urgency}
          </Badge>
        ),
      },
      {
        header: 'Homeowner',
        cell: ({ row }) => row.original.homeowner?.name ?? '—',
      },
      {
        header: 'Quotes',
        cell: ({ row }) => (
          <span className="tabular-nums">{row.original._count.quotes}</span>
        ),
      },
      {
        header: 'Posted',
        cell: ({ row }) => (
          <span className="whitespace-nowrap text-muted-foreground">
            {formatDate(row.original.createdAt)}
          </span>
        ),
      },
    ],
    [],
  );

  return (
    <div className="space-y-4">
      <Select
        items={STATUS_FILTERS}
        value={status}
        onValueChange={(v) => {
          setStatus(v as string);
          setPage(1);
        }}
      >
        <SelectTrigger className="w-48" aria-label="Filter by status">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {STATUS_FILTERS.map((item) => (
            <SelectItem key={item.value} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <DataTable
        columns={columns}
        data={data?.data ?? []}
        pageIndex={page - 1}
        pageCount={data?.meta.lastPage ?? 0}
        total={data?.meta.total ?? 0}
        onPageChange={(i) => setPage(i + 1)}
        isLoading={isPending}
        isError={isError}
        errorMessage={error instanceof Error ? error.message : undefined}
        emptyMessage="No jobs match this filter."
        onRowClick={(j) => router.push(`/jobs/${j.id}`)}
      />
    </div>
  );
}
