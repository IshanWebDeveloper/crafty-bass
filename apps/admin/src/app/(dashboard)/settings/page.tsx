import { AdminHeader } from '@/components/admin-header';
import { SettingsManager } from '@/components/settings-manager';

export default function SettingsPage() {
  return (
    <>
      <AdminHeader title="Settings" />
      <div className="flex flex-1 flex-col gap-6 p-6">
        <SettingsManager />
      </div>
    </>
  );
}
