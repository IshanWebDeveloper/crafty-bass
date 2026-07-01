'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { type ColumnDef } from '@tanstack/react-table';
import {
  Badge,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@repo/ui';
import { adminKeys } from '@/lib/query-keys';
import { DataTable } from '@/components/data-table';
import {
  listAuditLog,
  type AuditLogEntry,
  type ListAuditLogParams,
} from '@/lib/api/audit-log';

const PAGE_SIZE = 20;

// The entity strings the AuditService writes (see AdminService.log calls).
const ENTITY_FILTERS = [
  { value: 'all', label: 'All entities' },
  { value: 'User', label: 'User' },
];

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function AuditLogManager() {
  const [entity, setEntity] = useState('all');
  const [entityIdInput, setEntityIdInput] = useState('');
  const [entityId, setEntityId] = useState('');
  const [page, setPage] = useState(1);

  const params: ListAuditLogParams = useMemo(
    () => ({
      page,
      limit: PAGE_SIZE,
      ...(entity !== 'all' ? { entity } : {}),
      ...(entityId ? { entityId } : {}),
    }),
    [page, entity, entityId],
  );

  const { data, isPending, isError, error } = useQuery({
    queryKey: adminKeys.auditLogList(params),
    queryFn: () => listAuditLog(params),
  });

  const columns = useMemo<ColumnDef<AuditLogEntry, unknown>[]>(
    () => [
      {
        header: 'When',
        cell: ({ row }) => (
          <span className="whitespace-nowrap text-muted-foreground">
            {formatDateTime(row.original.createdAt)}
          </span>
        ),
      },
      {
        header: 'Actor',
        cell: ({ row }) => row.original.actor?.name ?? 'System',
      },
      {
        header: 'Action',
        cell: ({ row }) => (
          <Badge variant="outline">{row.original.action}</Badge>
        ),
      },
      {
        header: 'Entity',
        cell: ({ row }) => (
          <span>
            {row.original.entity}{' '}
            <code className="text-xs text-muted-foreground">
              {row.original.entityId}
            </code>
          </span>
        ),
      },
      {
        header: 'Details',
        cell: ({ row }) =>
          row.original.details ? (
            <code className="line-clamp-1 block max-w-xs text-xs text-muted-foreground">
              {JSON.stringify(row.original.details)}
            </code>
          ) : (
            <span className="text-muted-foreground">—</span>
          ),
      },
    ],
    [],
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Select
          items={ENTITY_FILTERS}
          value={entity}
          onValueChange={(v) => {
            setEntity(v as string);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-44" aria-label="Filter by entity">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ENTITY_FILTERS.map((item) => (
              <SelectItem key={item.value} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            setEntityId(entityIdInput.trim());
            setPage(1);
          }}
          className="flex items-center gap-2"
        >
          <Input
            value={entityIdInput}
            onChange={(e) => setEntityIdInput(e.target.value)}
            placeholder="Filter by entity ID…"
            className="w-64"
          />
        </form>
      </div>

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
        emptyMessage="No audit-log entries."
      />
    </div>
  );
}
