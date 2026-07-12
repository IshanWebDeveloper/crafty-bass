import { AdminHeader } from '@/components/admin-header';
import { UsersManager } from '@/components/users-manager';

export default function UsersPage() {
  return (
    <>
      <AdminHeader title="Users" />
      <div className="flex flex-1 flex-col gap-6 p-6">
        <UsersManager />
      </div>
    </>
  );
}
