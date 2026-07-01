import Link from 'next/link';
import { AdminHeader } from '@/components/admin-header';
import { VerificationDetail } from '@/components/verification-detail';

export default async function VerificationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <>
      <AdminHeader title="Verification review" />
      <div className="flex flex-1 flex-col gap-6 p-6">
        <Link
          href="/verifications"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← Back to queue
        </Link>
        <VerificationDetail id={id} />
      </div>
    </>
  );
}
