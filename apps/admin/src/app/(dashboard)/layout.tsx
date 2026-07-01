import { SidebarInset, SidebarProvider } from '@repo/ui/components/ui/sidebar';
import { AdminSidebar } from '@/components/admin-sidebar';
import { AuthGuard } from '@/components/auth-guard';

// Shared chrome for every authenticated admin screen: the role gate plus the
// collapsible sidebar and content inset. Individual pages render their own
// <AdminHeader /> + body inside this inset. The public /sign-in route lives
// outside this route group, so it gets no chrome.
export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthGuard>
      <SidebarProvider>
        <AdminSidebar />
        <SidebarInset>{children}</SidebarInset>
      </SidebarProvider>
    </AuthGuard>
  );
}
