import { AdminHeader } from '@/components/admin-header';
import { JobsManager } from '@/components/jobs-manager';

export default function JobsPage() {
  return (
    <>
      <AdminHeader title="Jobs" />
      <div className="flex flex-1 flex-col gap-6 p-6">
        <JobsManager />
      </div>
    </>
  );
}
