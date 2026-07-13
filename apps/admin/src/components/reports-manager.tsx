'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { type ColumnDef } from '@tanstack/react-table';
import {
  Badge,
  Button,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@repo/ui';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@repo/ui/components/ui/sheet';
import { ApiError } from '@/lib/api';
import { adminKeys } from '@/lib/query-keys';
import { useMe } from '@/lib/hooks/use-me';
import { DataTable } from '@/components/data-table';
import { ReportStatusBadge } from '@/components/status-badge';
import { Textarea } from '@/components/ui/textarea';
import {
  listReports,
  updateReport,
  type Report,
  type ReportStatus,
  type ListReportsParams,
} from '@/lib/api/reports';

const PAGE_SIZE = 20;

const STATUS_FILTERS: { value: string; label: string }[] = [
  { value: 'all', label: 'All statuses' },
  { value: 'OPEN', label: 'Open' },
  { value: 'UNDER_REVIEW', label: 'Under review' },
  { value: 'RESOLVED', label: 'Resolved' },
  { value: 'DISMISSED', label: 'Dismissed' },
];

const STATUS_OPTIONS: { value: ReportStatus; label: string }[] = [
  { value: 'OPEN', label: 'Open' },
  { value: 'UNDER_REVIEW', label: 'Under review' },
  { value: 'RESOLVED', label: 'Resolved' },
  { value: 'DISMISSED', label: 'Dismissed' },
];

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function ReportsManager() {
  const [status, setStatus] = useState('all');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Report | null>(null);

  const params: ListReportsParams = useMemo(
    () => ({
      page,
      limit: PAGE_SIZE,
      ...(status !== 'all' ? { status: status as ReportStatus } : {}),
    }),
    [page, status],
  );

  const { data, isPending, isError, error } = useQuery({
    queryKey: adminKeys.reportsList(params),
    queryFn: () => listReports(params),
  });

  const columns = useMemo<ColumnDef<Report, unknown>[]>(
    () => [
      {
        header: 'Reporter',
        accessorFn: (r) => r.reporter?.name ?? '-',
        cell: ({ row }) => (
          <span className="font-medium">
            {row.original.reporter?.name ?? '-'}
          </span>
        ),
      },
      {
        header: 'Target',
        cell: ({ row }) => (
          <Badge variant="outline">{row.original.targetType}</Badge>
        ),
      },
      {
        header: 'Reason',
        cell: ({ row }) => (
          <span className="line-clamp-1 max-w-xs text-muted-foreground">
            {row.original.reason}
          </span>
        ),
      },
      {
        header: 'Status',
        cell: ({ row }) => <ReportStatusBadge status={row.original.status} />,
      },
      {
        header: 'Assignee',
        cell: ({ row }) => row.original.assignee?.name ?? '-',
      },
      {
        header: 'Filed',
        cell: ({ row }) => (
          <span className="whitespace-nowrap text-muted-foreground">
            {formatDate(row.original.createdAt)}
          </span>
        ),
      },
    ],
    [],
  );

  const total = data?.meta.total ?? 0;
  const pageCount = data?.meta.lastPage ?? 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Select
          items={STATUS_FILTERS}
          value={status}
          onValueChange={(value) => {
            setStatus(value as string);
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
      </div>

      <DataTable
        columns={columns}
        data={data?.data ?? []}
        pageIndex={page - 1}
        pageCount={pageCount}
        total={total}
        onPageChange={(i) => setPage(i + 1)}
        isLoading={isPending}
        isError={isError}
        errorMessage={error instanceof Error ? error.message : undefined}
        emptyMessage="No reports match this filter."
        onRowClick={(r) => setSelected(r)}
      />

      <ReportSheet
        report={selected}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
      />
    </div>
  );
}

function ReportSheet({
  report,
  onOpenChange,
}: {
  report: Report | null;
  onOpenChange: (open: boolean) => void;
}) {
  const qc = useQueryClient();
  const { data: me } = useMe();

  const [status, setStatus] = useState<ReportStatus>('OPEN');
  const [notes, setNotes] = useState('');
  const [assigneeId, setAssigneeId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [lastId, setLastId] = useState<string | null>(null);

  // Sync the form to the selected report when it changes (opening a new row).
  if (report && report.id !== lastId) {
    setLastId(report.id);
    setStatus(report.status);
    setNotes(report.resolutionNotes ?? '');
    setAssigneeId(report.assigneeId);
    setFormError(null);
  }

  // Dismissing a report requires a rationale (enforced by the backend too) so
  // the reporter can be told why their concern was set aside.
  const dismissing = status === 'DISMISSED';
  const notesRequired = dismissing && notes.trim().length < 3;

  const save = useMutation({
    mutationFn: () =>
      updateReport(report!.id, {
        status,
        assigneeId,
        resolutionNotes: dismissing ? notes.trim() : notes.trim() || undefined,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: adminKeys.reports() });
      onOpenChange(false);
    },
    onError: (err) =>
      setFormError(
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Failed to update report',
      ),
  });

  const assignedToMe = !!me && assigneeId === me.id;

  return (
    <Sheet open={!!report} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        {report ? (
          <>
            <SheetHeader>
              <SheetTitle>Report detail</SheetTitle>
              <SheetDescription>
                Filed {formatDate(report.createdAt)} by{' '}
                {report.reporter?.name ?? 'a user'}
              </SheetDescription>
            </SheetHeader>

            <div className="flex flex-col gap-5 px-4 pb-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <Field label="Target type">
                  <Badge variant="outline">{report.targetType}</Badge>
                </Field>
                <Field label="Current status">
                  <ReportStatusBadge status={report.status} />
                </Field>
                <Field label="Target ID">
                  <code className="text-xs text-muted-foreground">
                    {report.targetId}
                  </code>
                </Field>
                {report.jobId ? (
                  <Field label="Related job">
                    <Link
                      href={`/jobs/${report.jobId}`}
                      className="text-xs text-primary hover:underline"
                    >
                      Open job to mediate →
                    </Link>
                  </Field>
                ) : null}
              </div>

              <Field label="Reason">
                <p className="rounded-md bg-muted/40 p-3 text-sm whitespace-pre-wrap">
                  {report.reason}
                </p>
              </Field>

              <div className="space-y-1.5">
                <span className="text-sm font-medium">Status</span>
                <Select
                  items={STATUS_OPTIONS}
                  value={status}
                  onValueChange={(v) => setStatus(v as ReportStatus)}
                >
                  <SelectTrigger aria-label="Set status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <span className="text-sm font-medium">Assignee</span>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">
                    {assignedToMe
                      ? 'Assigned to you'
                      : (report.assignee?.name ?? 'Unassigned')}
                  </span>
                  {me && !assignedToMe ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => setAssigneeId(me.id)}
                    >
                      Assign to me
                    </Button>
                  ) : null}
                  {assigneeId ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => setAssigneeId(null)}
                    >
                      Clear
                    </Button>
                  ) : null}
                </div>
              </div>

              <div className="space-y-1.5">
                <span className="text-sm font-medium">
                  Resolution notes{dismissing ? ' (required to dismiss)' : ''}
                </span>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder={
                    dismissing
                      ? 'Explain why this report is being dismissed…'
                      : 'Internal notes about how this was handled…'
                  }
                />
              </div>

              {formError ? (
                <p className="text-sm text-destructive">{formError}</p>
              ) : null}

              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => onOpenChange(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  disabled={save.isPending || notesRequired}
                  onClick={() => {
                    if (notesRequired) {
                      setFormError(
                        'Add a reason (at least 3 characters) to dismiss this report.',
                      );
                      return;
                    }
                    save.mutate();
                  }}
                >
                  {save.isPending ? 'Saving…' : 'Save changes'}
                </Button>
              </div>
            </div>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <div>{children}</div>
    </div>
  );
}
