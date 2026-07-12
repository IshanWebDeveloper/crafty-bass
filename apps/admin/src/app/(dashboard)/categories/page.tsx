import { AdminHeader } from '@/components/admin-header';
import { CategoriesManager } from '@/components/categories-manager';

export default function CategoriesPage() {
  return (
    <>
      <AdminHeader title="Categories" />
      <div className="flex flex-1 flex-col gap-6 p-6">
        <CategoriesManager />
      </div>
    </>
  );
}
