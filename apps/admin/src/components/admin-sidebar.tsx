'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { HammerIcon, ChevronRightIcon, LogOutIcon } from 'lucide-react';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@repo/ui/components/ui/collapsible';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarRail,
} from '@repo/ui/components/ui/sidebar';
import { signOut } from '@/lib/auth-client';
import { useMe } from '@/lib/hooks/use-me';
import { navForRole } from '@/lib/nav';

// Marks a link active on exact match, or when the current path is nested under
// it (but never treat the "/" overview as a prefix of everything).
function isActive(pathname: string, url: string) {
  if (url === '/') return pathname === '/';
  return pathname === url || pathname.startsWith(`${url}/`);
}

export function AdminSidebar({
  ...props
}: React.ComponentProps<typeof Sidebar>) {
  const pathname = usePathname();
  const me = useMe();
  const groups = navForRole(me.data?.role);

  // Control each group's open state so base-ui doesn't warn about a changing
  // `defaultOpen` when navigation flips which group is active. A group follows
  // its active state until the user explicitly toggles it.
  const [openOverrides, setOpenOverrides] = React.useState<
    Record<string, boolean>
  >({});

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" render={<Link href="/" />}>
              <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                <HammerIcon className="size-4" />
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-semibold">Crafty Bass</span>
                <span className="truncate text-xs text-muted-foreground">
                  Admin console
                </span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Platform</SidebarGroupLabel>
          <SidebarMenu>
            {groups.map((group) => {
              const groupActive = group.items.some((item) =>
                isActive(pathname, item.url),
              );
              const open = openOverrides[group.title] ?? groupActive;
              return (
                <Collapsible
                  key={group.title}
                  open={open}
                  onOpenChange={(next) =>
                    setOpenOverrides((prev) => ({
                      ...prev,
                      [group.title]: next,
                    }))
                  }
                  className="group/collapsible"
                  render={<SidebarMenuItem />}
                >
                  <CollapsibleTrigger
                    render={<SidebarMenuButton tooltip={group.title} />}
                  >
                    {group.icon}
                    <span>{group.title}</span>
                    <ChevronRightIcon className="ml-auto transition-transform duration-200 group-data-open/collapsible:rotate-90" />
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <SidebarMenuSub>
                      {group.items.map((item) => (
                        <SidebarMenuSubItem key={item.url}>
                          <SidebarMenuSubButton
                            isActive={isActive(pathname, item.url)}
                            render={<Link href={item.url} />}
                          >
                            <span>{item.title}</span>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                      ))}
                    </SidebarMenuSub>
                  </CollapsibleContent>
                </Collapsible>
              );
            })}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <div className="flex items-center gap-2 px-2 py-1.5 text-sm">
              <div className="grid flex-1 leading-tight">
                <span className="truncate font-medium">
                  {me.data?.name ?? 'Staff'}
                </span>
                <span className="truncate text-xs text-muted-foreground">
                  {me.data?.role ?? ''}
                </span>
              </div>
            </div>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              tooltip="Sign out"
              onClick={() => {
                void signOut().then(() => {
                  window.location.href = '/sign-in';
                });
              }}
            >
              <LogOutIcon />
              <span>Sign out</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
