import Link from 'next/link';
import { AdminHeader } from '@/components/admin-header';
import { UserDetail } from '@/components/user-detail';

export default async function UserDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <>
      <AdminHeader title="User detail" />
      <div className="flex flex-1 flex-col gap-6 p-6">
        <Link
          href="/users"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← Back to users
        </Link>
        <UserDetail id={id} />
      </div>
    </>
  );
}
