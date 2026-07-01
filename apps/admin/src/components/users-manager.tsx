'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { type ColumnDef } from '@tanstack/react-table';
import {
  Badge,
  Button,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@repo/ui';
import { adminKeys } from '@/lib/query-keys';
import { DataTable } from '@/components/data-table';
import { CreateStaffDialog } from '@/components/create-staff-dialog';
import {
  listUsers,
  type AdminUser,
  type ListUsersParams,
  type Role,
  type UserType,
} from '@/lib/api/users';

const PAGE_SIZE = 20;

const ROLE_FILTERS = [
  { value: 'all', label: 'All roles' },
  { value: 'CUSTOMER', label: 'Customers' },
  { value: 'SUPPORT', label: 'Support' },
  { value: 'ADMIN', label: 'Admins' },
];

const TYPE_FILTERS = [
  { value: 'all', label: 'All types' },
  { value: 'HOMEOWNER', label: 'Homeowners' },
  { value: 'TRADESMAN', label: 'Tradespeople' },
];

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function RoleBadge({ role }: { role: Role }) {
  if (role === 'ADMIN') return <Badge variant="default">Admin</Badge>;
  if (role === 'SUPPORT') return <Badge variant="info">Support</Badge>;
  return <Badge variant="muted">Customer</Badge>;
}

export function UsersManager() {
  const router = useRouter();
  const [role, setRole] = useState('all');
  const [userType, setUserType] = useState('all');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const params: ListUsersParams = useMemo(
    () => ({
      page,
      limit: PAGE_SIZE,
      ...(role !== 'all' ? { role: role as Role } : {}),
      ...(userType !== 'all' ? { userType: userType as UserType } : {}),
      ...(search ? { search } : {}),
    }),
    [page, role, userType, search],
  );

  const { data, isPending, isError, error } = useQuery({
    queryKey: adminKeys.usersList(params),
    queryFn: () => listUsers(params),
  });

  const columns = useMemo<ColumnDef<AdminUser, unknown>[]>(
    () => [
      {
        header: 'Name',
        cell: ({ row }) => (
          <div>
            <span className="font-medium">{row.original.name}</span>
            <span className="block text-xs text-muted-foreground">
              {row.original.email}
            </span>
          </div>
        ),
      },
      {
        header: 'Role',
        cell: ({ row }) => <RoleBadge role={row.original.role} />,
      },
      {
        header: 'Type',
        cell: ({ row }) =>
          row.original.userType ? (
            <Badge variant="outline">
              {row.original.userType === 'TRADESMAN'
                ? 'Tradesman'
                : 'Homeowner'}
            </Badge>
          ) : (
            <span className="text-muted-foreground">—</span>
          ),
      },
      {
        header: 'Status',
        cell: ({ row }) =>
          row.original.banned ? (
            <Badge variant="destructive">Banned</Badge>
          ) : (
            <Badge variant="success">Active</Badge>
          ),
      },
      {
        header: 'Joined',
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
      <div className="flex flex-wrap items-center gap-3">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setSearch(searchInput.trim());
            setPage(1);
          }}
          className="flex items-center gap-2"
        >
          <Input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search name or email…"
            className="w-64"
          />
          <Button type="submit" variant="outline">
            Search
          </Button>
        </form>

        <Select
          items={ROLE_FILTERS}
          value={role}
          onValueChange={(v) => {
            setRole(v as string);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-40" aria-label="Filter by role">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ROLE_FILTERS.map((item) => (
              <SelectItem key={item.value} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          items={TYPE_FILTERS}
          value={userType}
          onValueChange={(v) => {
            setUserType(v as string);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-40" aria-label="Filter by user type">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TYPE_FILTERS.map((item) => (
              <SelectItem key={item.value} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="ml-auto">
          <CreateStaffDialog />
        </div>
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
        emptyMessage="No users match these filters."
        onRowClick={(u) => router.push(`/users/${u.id}`)}
      />
    </div>
  );
}
