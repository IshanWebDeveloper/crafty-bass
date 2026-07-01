import { AdminHeader } from '@/components/admin-header';
import { DashboardOverview } from '@/components/dashboard-overview';

export default function AdminHome() {
  return (
    <>
      <AdminHeader title="Overview" />
      <div className="flex flex-1 flex-col gap-6 p-6">
        <DashboardOverview />
      </div>
    </>
  );
}
