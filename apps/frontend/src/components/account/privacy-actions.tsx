'use client';

import { useState } from 'react';
import { Button } from '@repo/ui';

type Status =
  | { kind: 'idle' }
  | { kind: 'pending'; message: string }
  | { kind: 'success'; message: string }
  | { kind: 'error'; message: string };

type Props = {
  apiBaseUrl: string;
};

export function PrivacyActions({ apiBaseUrl }: Props) {
  const [requestStatus, setRequestStatus] = useState<Status>({ kind: 'idle' });
  const [downloadStatus, setDownloadStatus] = useState<Status>({
    kind: 'idle',
  });

  async function requestExport() {
    setRequestStatus({ kind: 'pending', message: 'Queuing export…' });
    try {
      const response = await fetch(`${apiBaseUrl}/users/me/export`, {
        method: 'GET',
        credentials: 'include',
      });
      if (!response.ok) {
        throw new Error(`Request failed with status ${response.status}`);
      }
      setRequestStatus({
        kind: 'success',
        message:
          'Export queued. You will receive an email when it is ready to download.',
      });
    } catch (error) {
      setRequestStatus({
        kind: 'error',
        message:
          error instanceof Error ? error.message : 'Unable to queue export',
      });
    }
  }

  async function downloadLatest() {
    setDownloadStatus({
      kind: 'pending',
      message: 'Requesting download link…',
    });
    try {
      const response = await fetch(
        `${apiBaseUrl}/users/me/gdpr-exports/latest/download-url`,
        { method: 'GET', credentials: 'include' },
      );
      if (response.status === 404) {
        setDownloadStatus({
          kind: 'error',
          message:
            'No export is ready yet. Request one above and wait for the email.',
        });
        return;
      }
      if (!response.ok) {
        throw new Error(`Request failed with status ${response.status}`);
      }
      const data = (await response.json()) as { downloadUrl?: unknown };
      if (typeof data.downloadUrl !== 'string') {
        throw new Error('Server returned an invalid download URL');
      }
      setDownloadStatus({
        kind: 'success',
        message:
          'Download starting. The link expires in 15 minutes — request a new one if you need to download again later.',
      });
      window.location.href = data.downloadUrl;
    } catch (error) {
      setDownloadStatus({
        kind: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Unable to fetch download link',
      });
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-2">
        <h2 className="text-base font-medium text-foreground">
          Request a new data export
        </h2>
        <p className="text-sm text-muted-foreground">
          We&apos;ll prepare a ZIP archive of every record we hold against your
          account and email you when it&apos;s ready.
        </p>
        <div className="flex items-center gap-3">
          <Button
            onClick={requestExport}
            disabled={requestStatus.kind === 'pending'}
          >
            {requestStatus.kind === 'pending'
              ? 'Queuing…'
              : 'Request data export'}
          </Button>
          {requestStatus.kind !== 'idle' ? (
            <StatusText status={requestStatus} />
          ) : null}
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-base font-medium text-foreground">
          Download the latest export
        </h2>
        <p className="text-sm text-muted-foreground">
          The download link is generated on demand and tied to your signed-in
          session.
        </p>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            onClick={downloadLatest}
            disabled={downloadStatus.kind === 'pending'}
          >
            {downloadStatus.kind === 'pending'
              ? 'Preparing…'
              : 'Download latest export'}
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
