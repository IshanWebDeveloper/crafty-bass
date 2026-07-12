import { AdminHeader } from '@/components/admin-header';
import { VerificationsManager } from '@/components/verifications-manager';

export default function VerificationsPage() {
  return (
    <>
      <AdminHeader title="Verifications" />
      <div className="flex flex-1 flex-col gap-6 p-6">
        <VerificationsManager />
      </div>
    </>
  );
}
