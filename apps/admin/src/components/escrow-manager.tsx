'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { type ColumnDef } from '@tanstack/react-table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@repo/ui';
import { adminKeys } from '@/lib/query-keys';
import { DataTable } from '@/components/data-table';
import { EscrowStatusBadge } from '@/components/status-badge';
import {
  listEscrows,
  type AdminEscrow,
  type EscrowStatus,
  type ListEscrowsParams,
} from '@/lib/api/escrow';

const PAGE_SIZE = 20;

const STATUS_FILTERS = [
  { value: 'all', label: 'All statuses' },
  { value: 'REQUESTED', label: 'Requested' },
  { value: 'FUNDED', label: 'Funded' },
  { value: 'MATERIALS_RELEASED', label: 'Materials released' },
  { value: 'WORK_COMPLETED', label: 'Work completed' },
  { value: 'RELEASED', label: 'Released' },
  { value: 'REFUNDED', label: 'Refunded' },
  { value: 'CANCELLED', label: 'Cancelled' },
];

const lkr = new Intl.NumberFormat('en-LK', {
  style: 'currency',
  currency: 'LKR',
  maximumFractionDigits: 0,
});

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function EscrowManager() {
  const router = useRouter();
  const [status, setStatus] = useState('all');
  const [page, setPage] = useState(1);

  const params: ListEscrowsParams = useMemo(
    () => ({
      page,
      limit: PAGE_SIZE,
      ...(status !== 'all' ? { status: status as EscrowStatus } : {}),
    }),
    [page, status],
  );

  const { data, isPending, isError, error } = useQuery({
    queryKey: adminKeys.escrowsList(params),
    queryFn: () => listEscrows(params),
  });

  const columns = useMemo<ColumnDef<AdminEscrow, unknown>[]>(
    () => [
      {
        header: 'Job',
        cell: ({ row }) => (
          <span className="line-clamp-1 max-w-xs font-medium">
            {row.original.job?.title ?? '-'}
          </span>
        ),
      },
      {
        header: 'Status',
        cell: ({ row }) => <EscrowStatusBadge status={row.original.status} />,
      },
      {
        header: 'Total',
        cell: ({ row }) => (
          <span className="tabular-nums">
            {lkr.format(row.original.quoteTotal)}
          </span>
        ),
      },
      {
        header: 'Deposit',
        cell: ({ row }) => (
          <span className="tabular-nums text-muted-foreground">
            {lkr.format(row.original.depositAmount)}
          </span>
        ),
      },
      {
        header: 'Parties',
        cell: ({ row }) => (
          <span className="whitespace-nowrap text-muted-foreground">
            {row.original.homeowner?.name ?? '-'} →{' '}
            {row.original.tradesman?.name ?? '-'}
          </span>
        ),
      },
      {
        header: 'Created',
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
        <SelectTrigger className="w-56" aria-label="Filter by status">
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
        emptyMessage="No escrows match this filter."
        onRowClick={(e) => router.push(`/escrow/${e.id}`)}
      />
    </div>
  );
}
