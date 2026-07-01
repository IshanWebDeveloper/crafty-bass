'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@repo/ui';
import { ApiError } from '@/lib/api';
import { adminKeys } from '@/lib/query-keys';
import { VerificationStatusBadge } from '@/components/status-badge';
import { Textarea } from '@/components/ui/textarea';
import {
  approveVerification,
  getVerification,
  getVerificationDocuments,
  rejectVerification,
  type VerificationDetail as Detail,
} from '@/lib/api/verification';

function formatDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function VerificationDetail({ id }: { id: string }) {
  const router = useRouter();
  const qc = useQueryClient();
  const [rejectOpen, setRejectOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);

  const { data, isPending, isError, error } = useQuery({
    queryKey: adminKeys.verification(id),
    queryFn: () => getVerification(id),
  });

  const docs = useQuery({
    queryKey: adminKeys.verificationDocs(id),
    queryFn: () => getVerificationDocuments(id),
  });

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: adminKeys.verifications() });
  };

  const approve = useMutation({
    mutationFn: () => approveVerification(id),
    onSuccess: () => {
      invalidate();
      router.push('/verifications');
    },
    onError: (err) => setActionError(errMessage(err, 'Failed to approve')),
  });

  const reject = useMutation({
    mutationFn: () => rejectVerification(id, reason.trim()),
    onSuccess: () => {
      invalidate();
      router.push('/verifications');
    },
    onError: (err) => setActionError(errMessage(err, 'Failed to reject')),
  });

  if (isError) {
    return (
      <p className="text-sm text-destructive">
        Failed to load submission: {error.message}
      </p>
    );
  }

  if (isPending) {
    return (
      <div className="h-64 animate-pulse rounded-xl border border-border bg-muted/30" />
    );
  }

  const v: Detail = data;
  const decided = v.status !== 'PENDING';

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">
            {v.fullName ?? v.user?.name ?? 'Applicant'}
          </h2>
          <p className="text-sm text-muted-foreground">
            {v.user?.email}
            {v.user?.phone ? ` · ${v.user.phone}` : ''}
          </p>
        </div>
        <VerificationStatusBadge status={v.status} />
      </div>

      {decided ? (
        <div className="rounded-xl border border-border bg-muted/30 p-4 text-sm">
          <p>
            Reviewed by {v.reviewedBy?.name ?? '—'} on{' '}
            {formatDate(v.reviewedAt)}.
          </p>
          {v.rejectionReason ? (
            <p className="mt-1 text-destructive">Reason: {v.rejectionReason}</p>
          ) : null}
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="space-y-4 rounded-xl border border-border p-4">
          <h3 className="text-base font-medium">Applicant details</h3>
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <Detail_ label="NIC number" value={v.nicNumber} />
            <Detail_ label="Gender" value={v.gender} />
            <Detail_ label="Date of birth" value={v.dateOfBirth} />
            <Detail_ label="Primary trade" value={v.primaryTrade} />
            <Detail_
              label="Experience"
              value={
                v.yearsExperience != null ? `${v.yearsExperience} yrs` : null
              }
            />
            <Detail_
              label="Service radius"
              value={
                v.serviceRadiusKm != null ? `${v.serviceRadiusKm} km` : null
              }
            />
            <Detail_ label="Address" value={v.addressLine} />
            <Detail_
              label="Location"
              value={[v.city, v.district].filter(Boolean).join(', ') || null}
            />
            <Detail_ label="Licence no." value={v.licenceNumber} />
            <Detail_ label="Crew type" value={v.crewType} />
            <Detail_ label="Guarantor" value={v.guarantorName} />
            <Detail_ label="Guarantor NIC" value={v.guarantorNic} />
          </dl>
        </section>

        <section className="space-y-4 rounded-xl border border-border p-4">
          <h3 className="text-base font-medium">Documents</h3>
          {docs.isPending ? (
            <p className="text-sm text-muted-foreground">Loading documents…</p>
          ) : docs.isError ? (
            <p className="text-sm text-destructive">
              Failed to load documents.
            </p>
          ) : docs.data.documents.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No documents attached.
            </p>
          ) : (
            <>
              <p className="text-xs text-muted-foreground">
                Links expire in {Math.round(docs.data.expiresInSeconds / 60)}{' '}
                minutes.
              </p>
              <ul className="grid gap-2 sm:grid-cols-2">
                {docs.data.documents.map((doc, i) => (
                  <li key={`${doc.field}-${i}`}>
                    <a
                      href={doc.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm transition-colors hover:bg-muted/40"
                    >
                      <span>{doc.label}</span>
                      <span className="text-xs text-primary">Open ↗</span>
                    </a>
                  </li>
                ))}
              </ul>
            </>
          )}

          <div>
            <h4 className="text-sm font-medium">Payout account</h4>
            <dl className="mt-2 grid grid-cols-2 gap-3 text-sm">
              <Detail_ label="Holder" value={v.payoutAccountHolder} />
              <Detail_ label="Bank" value={v.payoutBank} />
              <Detail_ label="Branch" value={v.payoutBranch} />
              <Detail_ label="Account no." value={v.payoutAccountNumber} />
            </dl>
          </div>
        </section>
      </div>

      {!decided ? (
        <div className="space-y-3 rounded-xl border border-border p-4">
          <h3 className="text-base font-medium">Decision</h3>
          {rejectOpen ? (
            <div className="space-y-3">
              <Textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Explain why this submission is being rejected (shown to the applicant)…"
              />
              <div className="flex gap-2">
                <Button
                  variant="destructive"
                  disabled={reason.trim().length === 0 || reject.isPending}
                  onClick={() => reject.mutate()}
                >
                  {reject.isPending ? 'Rejecting…' : 'Confirm rejection'}
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => {
                    setRejectOpen(false);
                    setActionError(null);
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex gap-2">
              <Button
                disabled={approve.isPending}
                onClick={() => approve.mutate()}
              >
                {approve.isPending ? 'Approving…' : 'Approve'}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setRejectOpen(true);
                  setActionError(null);
                }}
              >
                Reject
              </Button>
            </div>
          )}
          {actionError ? (
            <p className="text-sm text-destructive">{actionError}</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function Detail_({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="space-y-0.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="font-medium">{value ?? '—'}</dd>
    </div>
  );
}

function errMessage(err: unknown, fallback: string) {
  if (err instanceof ApiError) return err.message;
  if (err instanceof Error) return err.message;
  return fallback;
}
