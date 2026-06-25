import { Checkbox, ModeToggle, Button } from '@repo/ui';
import { AppSidebar } from '@repo/ui/components/app-sidebar';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
} from '@repo/ui/components/ui/breadcrumb';
import { Separator } from '@repo/ui/components/ui/separator';
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from '@repo/ui/components/ui/sidebar';
import { DashboardStats } from '@/components/dashboard-stats';
import { AuthGuard } from '@/components/auth-guard';

export default function AdminHome() {
  return (
    <AuthGuard>
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
          <header className="flex h-16 shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
            <div className="flex w-full items-center gap-2 px-4">
              <SidebarTrigger className="-ml-1" />
              <Separator
                orientation="vertical"
                className="mr-2 data-vertical:h-4 data-vertical:self-auto"
              />
              <Breadcrumb>
                <BreadcrumbList>
                  <BreadcrumbItem>
                    <BreadcrumbPage>Overview</BreadcrumbPage>
                  </BreadcrumbItem>
                </BreadcrumbList>
              </Breadcrumb>
              <div className="ml-auto">
                <ModeToggle />
              </div>
            </div>
          </header>
          <div className="flex flex-1 flex-col gap-6 p-6">
            <DashboardStats />
            <div className="rounded-xl border border-border p-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg font-medium">Review queue</h2>
                  <p className="text-sm text-muted-foreground">
                    Triage reports, profile checks, and marketplace quality
                    tasks.
                  </p>
                </div>
                <Button>Open queue</Button>
              </div>
              <label className="mt-6 flex items-center gap-2 text-sm">
                <Checkbox aria-label="Show urgent items only" />
                Show urgent items only
              </label>
            </div>
          </div>
        </SidebarInset>
      </SidebarProvider>
    </AuthGuard>
  );
}
