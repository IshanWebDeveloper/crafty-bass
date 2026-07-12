import { AdminHeader } from '@/components/admin-header';
import { ReportsManager } from '@/components/reports-manager';

export default function ReportsPage() {
  return (
    <>
      <AdminHeader title="Reports" />
      <div className="flex flex-1 flex-col gap-6 p-6">
        <ReportsManager />
      </div>
    </>
  );
}
