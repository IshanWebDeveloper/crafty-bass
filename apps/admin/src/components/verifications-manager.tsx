'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { type ColumnDef } from '@tanstack/react-table';
import { adminKeys } from '@/lib/query-keys';
import { DataTable } from '@/components/data-table';
import {
  listPendingVerifications,
  type VerificationListItem,
  type ListVerificationsParams,
} from '@/lib/api/verification';

const PAGE_SIZE = 20;

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function VerificationsManager() {
  const router = useRouter();
  const [page, setPage] = useState(1);

  const params: ListVerificationsParams = useMemo(
    () => ({ page, limit: PAGE_SIZE }),
    [page],
  );

  const { data, isPending, isError, error } = useQuery({
    queryKey: adminKeys.verificationsList(params),
    queryFn: () => listPendingVerifications(params),
  });

  const columns = useMemo<ColumnDef<VerificationListItem, unknown>[]>(
    () => [
      {
        header: 'Applicant',
        cell: ({ row }) => (
          <div>
            <span className="font-medium">
              {row.original.fullName ?? row.original.user?.name ?? '—'}
            </span>
            <span className="block text-xs text-muted-foreground">
              {row.original.user?.email}
            </span>
          </div>
        ),
      },
      {
        header: 'Trade',
        cell: ({ row }) => row.original.primaryTrade ?? '—',
      },
      {
        header: 'Location',
        cell: ({ row }) =>
          [row.original.city, row.original.district]
            .filter(Boolean)
            .join(', ') || '—',
      },
      {
        header: 'Submitted',
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
      emptyMessage="No verifications are awaiting review."
      onRowClick={(r) => router.push(`/verifications/${r.id}`)}
    />
  );
}
