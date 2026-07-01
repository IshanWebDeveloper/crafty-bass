import { AdminHeader } from '@/components/admin-header';
import { ReviewsManager } from '@/components/reviews-manager';

export default function ReviewsPage() {
  return (
    <>
      <AdminHeader title="Reviews" />
      <div className="flex flex-1 flex-col gap-6 p-6">
        <ReviewsManager />
      </div>
    </>
  );
}
