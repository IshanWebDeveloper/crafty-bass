import Link from 'next/link';
import { AdminHeader } from '@/components/admin-header';
import { EscrowDetail } from '@/components/escrow-detail';

export default async function EscrowDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <>
      <AdminHeader title="Escrow detail" />
      <div className="flex flex-1 flex-col gap-6 p-6">
        <Link
          href="/escrow"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← Back to escrow
        </Link>
        <EscrowDetail id={id} />
      </div>
    </>
  );
}
