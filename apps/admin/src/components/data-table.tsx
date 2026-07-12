'use client';

import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
} from '@tanstack/react-table';
import { Button, cn } from '@repo/ui';

// A reusable, server-paginated table. The caller owns fetching (it passes the
// current page's `data` plus the total `pageCount`) and page state; this
// component only renders and drives page changes. Keeping pagination "manual"
// means the same component works for every admin list against the backend's
// buildPaginationMeta envelope.
export type DataTableProps<T> = {
  columns: ColumnDef<T, unknown>[];
  data: T[];
  pageIndex: number; // zero-based
  pageCount: number;
  total?: number;
  onPageChange: (pageIndex: number) => void;
  isLoading?: boolean;
  isError?: boolean;
  errorMessage?: string;
  emptyMessage?: string;
  onRowClick?: (row: T) => void;
};

export function DataTable<T>({
  columns,
  data,
  pageIndex,
  pageCount,
  total,
  onPageChange,
  isLoading,
  isError,
  errorMessage,
  emptyMessage = 'No results.',
  onRowClick,
}: DataTableProps<T>) {
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    pageCount,
  });

  const colCount = columns.length;

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-muted/40">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    className="px-3 py-2.5 text-left font-medium text-muted-foreground"
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
                        )}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, r) => (
                <tr key={r} className="border-b border-border last:border-0">
                  {Array.from({ length: colCount }).map((__, c) => (
                    <td key={c} className="px-3 py-3">
                      <span className="block h-4 w-full max-w-32 animate-pulse rounded bg-muted" />
                    </td>
                  ))}
                </tr>
              ))
            ) : isError ? (
              <tr>
                <td
                  colSpan={colCount}
                  className="px-3 py-10 text-center text-destructive"
                >
                  {errorMessage ?? 'Failed to load data.'}
                </td>
              </tr>
            ) : data.length === 0 ? (
              <tr>
                <td
                  colSpan={colCount}
                  className="px-3 py-10 text-center text-muted-foreground"
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  onClick={
                    onRowClick ? () => onRowClick(row.original) : undefined
                  }
                  className={cn(
                    'border-b border-border last:border-0',
                    onRowClick && 'cursor-pointer hover:bg-muted/40',
                  )}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-3 py-3 align-middle">
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext(),
                      )}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between gap-4 text-sm text-muted-foreground">
        <span>
          {total !== undefined
            ? `${total} result${total === 1 ? '' : 's'}`
            : null}
        </span>
        <div className="flex items-center gap-2">
          <span>
            Page {pageIndex + 1} of {Math.max(pageCount, 1)}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={pageIndex <= 0 || isLoading}
            onClick={() => onPageChange(pageIndex - 1)}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={pageIndex + 1 >= pageCount || isLoading}
            onClick={() => onPageChange(pageIndex + 1)}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}
