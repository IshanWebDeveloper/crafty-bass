import { AdminHeader } from '@/components/admin-header';
import { AuditLogManager } from '@/components/audit-log-manager';

export default function AuditLogPage() {
  return (
    <>
      <AdminHeader title="Audit log" />
      <div className="flex flex-1 flex-col gap-6 p-6">
        <AuditLogManager />
      </div>
    </>
  );
}
