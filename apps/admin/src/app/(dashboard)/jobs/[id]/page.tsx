import Link from 'next/link';
import { AdminHeader } from '@/components/admin-header';
import { JobDetail } from '@/components/job-detail';

export default async function JobDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <>
      <AdminHeader title="Job detail" />
      <div className="flex flex-1 flex-col gap-6 p-6">
        <Link
          href="/jobs"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← Back to jobs
        </Link>
        <JobDetail id={id} />
      </div>
    </>
  );
}
