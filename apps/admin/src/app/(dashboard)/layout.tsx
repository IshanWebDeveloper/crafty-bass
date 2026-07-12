import { SidebarInset, SidebarProvider } from '@repo/ui/components/ui/sidebar';
import { AdminSidebar } from '@/components/admin-sidebar';
import { AccessDenied } from '@/components/access-denied';
import { requireAdmin } from '@/lib/server-session';

// Shared chrome for every authenticated admin screen: the server-side role gate
// plus the collapsible sidebar and content inset. requireAdmin() redirects
// signed-out visitors to /sign-in before any client render; a signed-in user
// without the ADMIN/SUPPORT role gets the access-denied notice instead of the
// dashboard. Individual pages render their own <AdminHeader /> + body inside
// this inset. The public /sign-in route lives outside this route group, so it
// gets no chrome.
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { authorized } = await requireAdmin();

  if (!authorized) {
    return <AccessDenied />;
  }

  return (
    <SidebarProvider>
      <AdminSidebar />
      <SidebarInset>{children}</SidebarInset>
    </SidebarProvider>
  );
}
