'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Input } from '@repo/ui';
import { ApiError } from '@/lib/api';
import { adminKeys } from '@/lib/query-keys';
import { Textarea } from '@/components/ui/textarea';
import {
  getPrivacyPolicy,
  updatePrivacyPolicy,
  type PrivacyPolicy,
} from '@/lib/api/legal';

export function SettingsManager() {
  const qc = useQueryClient();
  const { data, isPending, isError, error } = useQuery({
    queryKey: adminKeys.privacyPolicy(),
    queryFn: getPrivacyPolicy,
  });

  if (isError) {
    return (
      <p className="text-sm text-destructive">
        Failed to load privacy policy: {error.message}
      </p>
    );
  }

  if (isPending) {
    return (
      <div className="h-96 animate-pulse rounded-xl border border-border bg-muted/30" />
    );
  }

  return <PrivacyPolicyEditor policy={data} qc={qc} />;
}

function PrivacyPolicyEditor({
  policy,
  qc,
}: {
  policy: PrivacyPolicy;
  qc: ReturnType<typeof useQueryClient>;
}) {
  const [title, setTitle] = useState(policy.title);
  const [version, setVersion] = useState(policy.version);
  const [content, setContent] = useState(policy.content);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: () =>
      updatePrivacyPolicy({
        title: title.trim(),
        version: version.trim(),
        content,
      }),
    onSuccess: (updated) => {
      setStatus(`Saved version ${updated.version}.`);
      setError(null);
      void qc.invalidateQueries({ queryKey: adminKeys.privacyPolicy() });
    },
    onError: (err) => {
      setStatus(null);
      setError(
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Failed to save',
      );
    },
  });

  const canSubmit =
    title.trim().length >= 3 &&
    version.trim().length >= 1 &&
    content.length >= 32 &&
    !save.isPending;

  return (
    <section className="space-y-4 rounded-xl border border-border p-4">
      <div>
        <h2 className="text-lg font-medium">Privacy policy</h2>
        <p className="text-sm text-muted-foreground">
          Published at <code>/legal/privacy-policy</code>. Bump the version when
          the wording materially changes. Markdown is supported.
        </p>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (canSubmit) save.mutate();
        }}
        className="space-y-4"
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-1.5">
            <span className="text-sm font-medium">Title</span>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </label>
          <label className="space-y-1.5">
            <span className="text-sm font-medium">Version</span>
            <Input
              value={version}
              onChange={(e) => setVersion(e.target.value)}
              placeholder="e.g. 2026-07-01"
            />
          </label>
        </div>

        <label className="space-y-1.5">
          <span className="text-sm font-medium">Content (Markdown)</span>
          <Textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="min-h-96 font-mono text-xs"
          />
        </label>

        <div className="flex items-center gap-3">
          <Button type="submit" disabled={!canSubmit}>
            {save.isPending ? 'Saving…' : 'Save policy'}
          </Button>
          {status ? (
            <span className="text-sm text-primary">{status}</span>
          ) : null}
          {error ? (
            <span className="text-sm text-destructive">{error}</span>
          ) : null}
        </div>
      </form>
    </section>
  );
}
