'use client';

import { useState } from 'react';
import { Button } from '@repo/ui';
import { apiFetch, ApiError } from '@/lib/api';
import { useI18n } from '@/i18n/provider';

type Status =
  | { kind: 'idle' }
  | { kind: 'pending'; message: string }
  | { kind: 'success'; message: string }
  | { kind: 'error'; message: string };

export function PrivacyActions() {
  const { dict } = useI18n();
  const t = dict.privacy;
  const s = t.status;

  const [requestStatus, setRequestStatus] = useState<Status>({ kind: 'idle' });
  const [downloadStatus, setDownloadStatus] = useState<Status>({
    kind: 'idle',
  });

  async function requestExport() {
    setRequestStatus({ kind: 'pending', message: s.queuing });
    try {
      await apiFetch('/users/me/export');
      setRequestStatus({ kind: 'success', message: s.queued });
    } catch (error) {
      setRequestStatus({
        kind: 'error',
        message: error instanceof Error ? error.message : s.queueError,
      });
    }
  }

  async function downloadLatest() {
    setDownloadStatus({ kind: 'pending', message: s.requestingLink });
    try {
      const data = await apiFetch<{ downloadUrl?: unknown }>(
        '/users/me/gdpr-exports/latest/download-url',
      );
      if (typeof data.downloadUrl !== 'string') {
        throw new Error(s.invalidUrl);
      }
      setDownloadStatus({ kind: 'success', message: s.downloadStarting });
      window.location.href = data.downloadUrl;
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) {
        setDownloadStatus({ kind: 'error', message: s.noExport });
        return;
      }
      setDownloadStatus({
        kind: 'error',
        message: error instanceof Error ? error.message : s.downloadError,
      });
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-2">
        <h2 className="text-base font-medium text-foreground">
          {t.requestHeading}
        </h2>
        <p className="text-sm text-muted-foreground">{t.requestBody}</p>
        <div className="flex items-center gap-3">
          <Button
            onClick={requestExport}
            disabled={requestStatus.kind === 'pending'}
          >
            {requestStatus.kind === 'pending'
              ? t.requestButtonPending
              : t.requestButton}
          </Button>
          {requestStatus.kind !== 'idle' ? (
            <StatusText status={requestStatus} />
          ) : null}
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-base font-medium text-foreground">
          {t.downloadHeading}
        </h2>
        <p className="text-sm text-muted-foreground">{t.downloadBody}</p>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            onClick={downloadLatest}
            disabled={downloadStatus.kind === 'pending'}
          >
            {downloadStatus.kind === 'pending'
              ? t.downloadButtonPending
              : t.downloadButton}
          </Button>
          {downloadStatus.kind !== 'idle' ? (
            <StatusText status={downloadStatus} />
          ) : null}
        </div>
      </section>
    </div>
  );
}

function StatusText({ status }: { status: Exclude<Status, { kind: 'idle' }> }) {
  const tone =
    status.kind === 'error'
      ? 'text-destructive'
      : status.kind === 'success'
        ? 'text-foreground'
        : 'text-muted-foreground';
  return (
    <p className={`text-sm ${tone}`} role="status" aria-live="polite">
      {status.message}
    </p>
  );
}
