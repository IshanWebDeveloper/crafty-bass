import { AdminHeader } from '@/components/admin-header';
import { EscrowManager } from '@/components/escrow-manager';

export default function EscrowPage() {
  return (
    <>
      <AdminHeader title="Escrow" />
      <div className="flex flex-1 flex-col gap-6 p-6">
        <EscrowManager />
      </div>
    </>
  );
}
