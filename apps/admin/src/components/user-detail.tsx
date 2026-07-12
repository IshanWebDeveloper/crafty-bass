'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Badge,
  Button,
  RatingStars,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@repo/ui';
import { ApiError } from '@/lib/api';
import { adminKeys } from '@/lib/query-keys';
import { useMe } from '@/lib/hooks/use-me';
import { Textarea } from '@/components/ui/textarea';
import {
  banUser,
  getUser,
  setUserRole,
  unbanUser,
  type Role,
  type UserDetail as Detail,
} from '@/lib/api/users';

const ROLE_OPTIONS = [
  { value: 'CUSTOMER', label: 'Customer' },
  { value: 'SUPPORT', label: 'Support' },
  { value: 'ADMIN', label: 'Admin' },
];

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function errMessage(err: unknown, fallback: string) {
  if (err instanceof ApiError) return err.message;
  if (err instanceof Error) return err.message;
  return fallback;
}

export function UserDetail({ id }: { id: string }) {
  const qc = useQueryClient();
  const { data: me } = useMe();
  const [banOpen, setBanOpen] = useState(false);
  const [banReason, setBanReason] = useState('');
  const [role, setRole] = useState<Role | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const { data, isPending, isError, error } = useQuery({
    queryKey: adminKeys.user(id),
    queryFn: () => getUser(id),
  });

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: adminKeys.user(id) });
    void qc.invalidateQueries({ queryKey: adminKeys.users() });
  };

  const ban = useMutation({
    mutationFn: () => banUser(id, banReason.trim() || undefined),
    onSuccess: () => {
      invalidate();
      setBanOpen(false);
      setBanReason('');
    },
    onError: (err) => setActionError(errMessage(err, 'Failed to ban user')),
  });

  const unban = useMutation({
    mutationFn: () => unbanUser(id),
    onSuccess: invalidate,
    onError: (err) => setActionError(errMessage(err, 'Failed to unban user')),
  });

  const changeRole = useMutation({
    mutationFn: (next: Role) => setUserRole(id, next),
    onSuccess: () => {
      invalidate();
      setRole(null);
    },
    onError: (err) => setActionError(errMessage(err, 'Failed to change role')),
  });

  if (isError) {
    return (
      <p className="text-sm text-destructive">
        Failed to load user: {error.message}
      </p>
    );
  }

  if (isPending) {
    return (
      <div className="h-64 animate-pulse rounded-xl border border-border bg-muted/30" />
    );
  }

  const u: Detail = data;
  const isSelf = me?.id === u.id;
  const effectiveRole = role ?? u.role;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">{u.name}</h2>
          <p className="text-sm text-muted-foreground">
            {u.email}
            {u.phone ? ` · ${u.phone}` : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {u.banned ? (
            <Badge variant="destructive">Banned</Badge>
          ) : (
            <Badge variant="success">Active</Badge>
          )}
          <Badge variant="outline">{u.role}</Badge>
          {u.userType ? (
            <Badge variant="muted">
              {u.userType === 'TRADESMAN' ? 'Tradesman' : 'Homeowner'}
            </Badge>
          ) : null}
        </div>
      </div>

      <div className="grid gap-3 rounded-xl border border-border p-4 text-sm sm:grid-cols-2">
        <Field label="Joined" value={formatDate(u.createdAt)} />
        <Field label="User ID" value={u.id} mono />
        {u.banned && u.banReason ? (
          <Field label="Ban reason" value={u.banReason} />
        ) : null}
      </div>

      {u.tradesmanProfile ? (
        <section className="space-y-3 rounded-xl border border-border p-4">
          <h3 className="text-base font-medium">Tradesman profile</h3>
          <div className="flex flex-wrap items-center gap-4 text-sm">
            <RatingStars
              value={Number(u.tradesmanProfile.avgRating)}
              count={u.tradesmanProfile.ratingCount}
            />
            <span className="text-muted-foreground">
              {u.tradesmanProfile.jobsCompleted} jobs completed
            </span>
            <span className="text-muted-foreground">
              {u.tradesmanProfile.yearsExperience} yrs experience
            </span>
            {u.tradesmanProfile.isVerified ? (
              <Badge variant="success">Verified</Badge>
            ) : null}
            {u.tradesmanProfile.backgroundChecked ? (
              <Badge variant="info">Background checked</Badge>
            ) : null}
          </div>
          <p className="text-sm text-muted-foreground">
            {[u.tradesmanProfile.city, u.tradesmanProfile.district]
              .filter(Boolean)
              .join(', ') || 'No location set'}
          </p>
        </section>
      ) : null}

      {u.homeownerProfile ? (
        <section className="space-y-2 rounded-xl border border-border p-4">
          <h3 className="text-base font-medium">Homeowner profile</h3>
          <p className="text-sm text-muted-foreground">
            {u.homeownerProfile.locationText ||
              [u.homeownerProfile.city, u.homeownerProfile.district]
                .filter(Boolean)
                .join(', ') ||
              'No location set'}
          </p>
        </section>
      ) : null}

      <section className="space-y-4 rounded-xl border border-border p-4">
        <h3 className="text-base font-medium">Moderation</h3>
        {isSelf ? (
          <p className="text-sm text-muted-foreground">
            You cannot moderate your own account.
          </p>
        ) : (
          <>
            <div className="flex flex-wrap items-end gap-3">
              <div className="space-y-1.5">
                <span className="block text-sm font-medium">Role</span>
                <div className="flex items-center gap-2">
                  <Select
                    items={ROLE_OPTIONS}
                    value={effectiveRole}
                    onValueChange={(v) => setRole(v as Role)}
                  >
                    <SelectTrigger className="w-40" aria-label="Change role">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ROLE_OPTIONS.map((item) => (
                        <SelectItem key={item.value} value={item.value}>
                          {item.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    variant="outline"
                    disabled={effectiveRole === u.role || changeRole.isPending}
                    onClick={() => changeRole.mutate(effectiveRole)}
                  >
                    {changeRole.isPending ? 'Saving…' : 'Update role'}
                  </Button>
                </div>
              </div>

              <div className="ml-auto">
                {u.banned ? (
                  <Button
                    variant="outline"
                    disabled={unban.isPending}
                    onClick={() => unban.mutate()}
                  >
                    {unban.isPending ? 'Unbanning…' : 'Unban user'}
                  </Button>
                ) : banOpen ? null : (
                  <Button
                    variant="destructive"
                    onClick={() => {
                      setBanOpen(true);
                      setActionError(null);
                    }}
                  >
                    Ban user
                  </Button>
                )}
              </div>
            </div>

            {banOpen && !u.banned ? (
              <div className="space-y-3 rounded-lg border border-border p-3">
                <Textarea
                  value={banReason}
                  onChange={(e) => setBanReason(e.target.value)}
                  placeholder="Reason for the ban (optional, shown internally)…"
                />
                <div className="flex gap-2">
                  <Button
                    variant="destructive"
                    disabled={ban.isPending}
                    onClick={() => ban.mutate()}
                  >
                    {ban.isPending ? 'Banning…' : 'Confirm ban'}
                  </Button>
                  <Button variant="ghost" onClick={() => setBanOpen(false)}>
                    Cancel
                  </Button>
                </div>
              </div>
            ) : null}

            {actionError ? (
              <p className="text-sm text-destructive">{actionError}</p>
            ) : null}
          </>
        )}
      </section>
    </div>
  );
}

function Field({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="space-y-0.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <p className={mono ? 'font-mono text-xs' : 'font-medium'}>{value}</p>
    </div>
  );
}
